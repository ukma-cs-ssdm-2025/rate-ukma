import { Array as Arr, Effect, Result, Schema } from "effect";
import { parseFilterOptions } from "../saz/catalog.ts";
import {
	Level,
	type ParsedOffering,
	parseCoursePage,
} from "../saz/coursePage.ts";
import {
	type OfferingRows,
	OfferingStore,
	type StoredProgramme,
} from "./OfferingStore.ts";

const BATCH_SIZE = 500;

/** The catalog filter values, by the name a card uses. Programme options
 *  carry the level, as in `Вигадана інженерія (Бакалавр)`. */
export interface CatalogFilters {
	readonly faculties: ReadonlyMap<string, string>;
	readonly departments: ReadonlyMap<string, string>;
	readonly programmes: ReadonlyMap<string, string>;
}

export const catalogFiltersOf = (html: string): CatalogFilters => ({
	faculties: parseFilterOptions(html, "faculty"),
	departments: parseFilterOptions(html, "subfaculty"),
	programmes: parseFilterOptions(html, "spec"),
});

const levelLabel = Schema.encodeSync(Level);

/** `2025` and `FALL` are `2025-26-FALL`. */
export const termCode = (academicYear: number, season: string): string =>
	`${academicYear}-${String(academicYear + 1).slice(2)}-${season}`;

const unique = <T>(rows: ReadonlyArray<T>, key: (row: T) => string) => [
	...new Map(rows.map((row) => [key(row), row])).values(),
];

const LEVELS: ReadonlyArray<ParsedOffering["level"]> = ["bachelor", "master"];

/** A card names its programmes without a level. The catalog lists each
 *  programme with one, and a card of one level can count for a programme that
 *  exists only at the other, so the catalog decides. When it lists neither, a
 *  stored programme of that name keeps its level, so its id stays; the card's
 *  level is the last fallback. */
const programmeOf = (
	name: string,
	cardLevel: ParsedOffering["level"],
	filters: CatalogFilters,
	stored: ReadonlySet<string>,
) => {
	const levels = [cardLevel, ...LEVELS.filter((other) => other !== cardLevel)];

	for (const level of levels) {
		const sazFilterId = filters.programmes.get(
			`${name} (${levelLabel(level)})`,
		);

		if (sazFilterId !== undefined) return { name, level, sazFilterId };
	}

	const level =
		levels.find((candidate) => stored.has(`${candidate} ${name}`)) ?? cardLevel;

	return { name, level, sazFilterId: null };
};

export interface ParsedPage {
	readonly snapshotId: bigint;
	readonly offering: ParsedOffering;
}

/** The rows of a batch of parsed pages, each reference row once. */
export const offeringRowsOf = (
	pages: ReadonlyArray<ParsedPage>,
	filters: CatalogFilters,
	storedProgrammes: ReadonlyArray<StoredProgramme> = [],
): OfferingRows => {
	const offerings = pages.map(({ offering }) => offering);

	const stored = new Set(
		storedProgrammes.map(({ name, level }) => `${level} ${name}`),
	);

	return {
		faculties: unique(
			offerings.flatMap(({ faculty }) =>
				faculty === null
					? []
					: [
							{
								name: faculty,
								sazFilterId: filters.faculties.get(faculty) ?? null,
							},
						],
			),
			({ name }) => name,
		),
		departments: unique(
			offerings.flatMap(({ department, faculty }) =>
				department === null
					? []
					: [
							{
								name: department,
								faculty,
								sazFilterId: filters.departments.get(department) ?? null,
							},
						],
			),
			({ name }) => name,
		),
		programmes: unique(
			offerings.flatMap(({ level, programmes }) =>
				programmes.map(({ name }) => programmeOf(name, level, filters, stored)),
			),
			({ name, level }) => `${level} ${name}`,
		),
		terms: unique(
			offerings.flatMap(({ academicYear, terms }) =>
				terms.map(({ season }) => ({
					code: termCode(academicYear, season),
					academicYear,
					season,
				})),
			),
			({ code }) => code,
		),
		offerings: pages.map(
			({
				snapshotId,
				offering: { terms: _terms, programmes: _programmes, ...offering },
			}) => ({
				...offering,
				snapshotId: String(snapshotId),
			}),
		),
		offeringTerms: offerings.flatMap(({ sazCode, academicYear, terms }) =>
			terms.map(({ season, ...term }) => ({
				...term,
				sazCode,
				termCode: termCode(academicYear, season),
			})),
		),
		offeringProgrammes: offerings.flatMap(({ sazCode, level, programmes }) =>
			programmes.map(({ name, kind }) => ({
				sazCode,
				name,
				level: programmeOf(name, level, filters, stored).level,
				kind,
			})),
		),
	};
};

export interface ParseReport {
	readonly parsed: number;
	/** Failed pages by reason. */
	readonly failed: ReadonlyArray<{
		readonly reason: string;
		readonly pages: number;
	}>;
}

/** Parses the latest snapshot of every course page into offerings and their
 *  reference lists. A page that fails keeps the rows of its last good parse. */
export const parseOfferings = Effect.fn("parseOfferings")(function* () {
	const store = yield* OfferingStore;
	const catalogPage = yield* store.latestCatalogPage;

	if (catalogPage === undefined) {
		yield* Effect.logWarning("No catalog page stored, so no filter ids");
	}

	const filters = catalogFiltersOf(catalogPage ?? "");
	const failed = new Map<string, number>();
	let parsed = 0;

	for (const ids of Arr.chunksOf(yield* store.latestCoursePages, BATCH_SIZE)) {
		const pages: Array<ParsedPage> = [];

		for (const page of yield* store.coursePages(ids)) {
			const result = parseCoursePage(
				page.content,
				page.path.slice("/course/".length),
			);

			if (Result.isSuccess(result)) {
				pages.push({ snapshotId: page.id, offering: result.success });
				continue;
			}

			const { reason } = result.failure;

			failed.set(reason, (failed.get(reason) ?? 0) + 1);
			yield* Effect.logWarning("Course page failed to parse", {
				path: page.path,
				snapshot_id: String(page.id),
				reason,
			});
		}

		const rows = offeringRowsOf(pages, filters, yield* store.programmes);

		// A batch the database rejects keeps its last good rows, like a page that
		// fails to parse, and the run goes on to the next batch.
		const written = yield* store.write(rows).pipe(
			Effect.as(true),
			Effect.catchCause((cause) =>
				Effect.logError("Offering batch failed to store", {
					first_snapshot_id: String(ids[0]),
					last_snapshot_id: String(ids.at(-1)),
					cause,
				}).pipe(Effect.as(false)),
			),
		);

		if (written) {
			parsed += pages.length;
		} else {
			failed.set("store", (failed.get("store") ?? 0) + pages.length);
		}
	}

	const report: ParseReport = {
		parsed,
		failed: Array.from(failed, ([reason, pages]) => ({ reason, pages })),
	};

	yield* Effect.logInfo("Offerings parsed", report);

	return report;
});
