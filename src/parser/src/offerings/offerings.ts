import { Array as Arr, Clock, Effect, Result, Schema } from "effect";
import { parseFilterOptions } from "../saz/catalog.ts";
import {
	Level,
	type ParsedOffering,
	parseCoursePage,
} from "../saz/coursePage.ts";
import {
	OfferingStore,
	type OfferingRows,
	type ParseFailure,
	type ParseReport,
	type ParseTrigger,
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
 *  exists only at the other, so the catalog decides; the card's level is the
 *  fallback. */
const programmeOf = (
	name: string,
	cardLevel: ParsedOffering["level"],
	filters: CatalogFilters,
) => {
	for (const level of [
		cardLevel,
		...LEVELS.filter((other) => other !== cardLevel),
	]) {
		const sazFilterId = filters.programmes.get(
			`${name} (${levelLabel(level)})`,
		);

		if (sazFilterId !== undefined) return { name, level, sazFilterId };
	}

	return { name, level: cardLevel, sazFilterId: null };
};

export interface ParsedPage {
	readonly snapshotId: bigint;
	readonly offering: ParsedOffering;
}

/** The rows of a batch of parsed pages, each reference row once. */
export const offeringRowsOf = (
	pages: ReadonlyArray<ParsedPage>,
	filters: CatalogFilters,
): OfferingRows => {
	const offerings = pages.map(({ offering }) => offering);

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
				programmes.map(({ name }) => programmeOf(name, level, filters)),
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
				level: programmeOf(name, level, filters).level,
				kind,
			})),
		),
	};
};

/** Parses the latest snapshot of every course page into offerings and their
 *  reference lists, and records the parse. A page that fails keeps the rows of
 *  its last good parse, and the failure is recorded with its snapshot. */
export const parseOfferings = Effect.fn("parseOfferings")(function* (
	trigger: ParseTrigger,
) {
	const store = yield* OfferingStore;
	const startedAt = yield* Clock.currentTimeMillis;
	const parseId = yield* store.startParse(trigger);
	const catalogPage = yield* store.latestCatalogPage;

	if (catalogPage === undefined) {
		yield* Effect.logWarning("No catalog page stored, so no filter ids");
	}

	const filters = catalogFiltersOf(catalogPage ?? "");
	const failed = new Map<string, number>();
	let parsed = 0;

	for (const ids of Arr.chunksOf(yield* store.latestCoursePages, BATCH_SIZE)) {
		const pages: Array<ParsedPage> = [];
		const failures: Array<ParseFailure> = [];

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
			failures.push({ snapshotId: page.id, path: page.path, reason });
			yield* Effect.logWarning("Course page failed to parse", {
				path: page.path,
				snapshot_id: String(page.id),
				reason,
			});
		}

		yield* store.write(offeringRowsOf(pages, filters));
		yield* store.recordFailures(parseId, failures);
		parsed += pages.length;
	}

	const report: ParseReport = {
		seconds: Math.round(((yield* Clock.currentTimeMillis) - startedAt) / 1000),
		parsed,
		failed: Array.from(failed, ([reason, pages]) => ({ reason, pages })),
	};

	yield* store.finishParse(parseId, report);
	yield* Effect.logInfo("Offerings parsed", report).pipe(
		Effect.annotateLogs({ parse_id: String(parseId), trigger }),
	);

	return report;
});
