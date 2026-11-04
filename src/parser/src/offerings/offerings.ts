import {
	Array as Arr,
	Cause,
	Effect,
	Exit,
	Option,
	Record as Rec,
	Result,
	Schema,
	Struct,
} from "effect";
import { SqlError } from "effect/sql";
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

const FILTER_NAMES = {
	faculties: "faculty",
	departments: "subfaculty",
	programmes: "spec",
} as const satisfies Record<keyof CatalogFilters, string>;

export const catalogFiltersOf = (html: string): CatalogFilters =>
	Rec.map(FILTER_NAMES, (name) => parseFilterOptions(html, name));

/** The filters with no options, as `filter[subfaculty]`. A unit or programme
 *  new to the run gets no filter id from them, so a САЗ markup change that
 *  drops one shows here instead of as quiet nulls. */
export const missingFilters = (
	filters: CatalogFilters,
): ReadonlyArray<string> =>
	Struct.keys(FILTER_NAMES).flatMap((key) =>
		filters[key].size === 0 ? [`filter[${FILTER_NAMES[key]}]`] : [],
	);

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

	const offeringProgrammes = offerings.flatMap(
		({ sazCode, level, programmes }) =>
			programmes.map(({ name, kind }) => ({
				sazCode,
				kind,
				programme: programmeOf(name, level, filters, stored),
			})),
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
		// A card may name a department without its faculty; one that names it wins.
		departments: unique(
			offerings
				.flatMap(({ department, faculty }) =>
					department === null
						? []
						: [
								{
									name: department,
									faculty,
									sazFilterId: filters.departments.get(department) ?? null,
								},
							],
				)
				.sort(
					(a, b) => Number(a.faculty !== null) - Number(b.faculty !== null),
				),
			({ name }) => name,
		),
		programmes: unique(
			offeringProgrammes.map(({ programme }) => programme),
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
		offerings: pages.map(({ snapshotId, offering }) => ({
			...Struct.omit(offering, ["terms", "programmes"]),
			snapshotId: String(snapshotId),
		})),
		offeringTerms: offerings.flatMap(({ sazCode, academicYear, terms }) =>
			terms.map(({ season, ...term }) => ({
				...term,
				sazCode,
				termCode: termCode(academicYear, season),
			})),
		),
		offeringProgrammes: offeringProgrammes.map(
			({ sazCode, kind, programme: { name, level } }) => ({
				sazCode,
				name,
				level,
				kind,
			}),
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
	/** Catalog filters with no options, from `missingFilters`. */
	readonly missing: ReadonlyArray<string>;
}

const PgFields = Schema.Struct({
	code: Schema.optional(Schema.String),
	table: Schema.optional(Schema.String),
	column: Schema.optional(Schema.String),
	constraint: Schema.optional(Schema.String),
});

const pgFieldsOf = Schema.decodeUnknownOption(PgFields);

/** Postgres puts the failing row in an error's `detail`, and an offering row
 *  carries teacher names, so a failed write logs only what names the error. */
export const storeFailureOf = (cause: Cause.Cause<unknown>) => {
	const error = Cause.squash(cause);

	if (!SqlError.isSqlError(error)) return { reason: "defect" };

	return {
		reason: error.reason._tag,
		...Option.getOrUndefined(pgFieldsOf(error.reason.cause)),
	};
};

/** Parses the latest snapshot of every course page into offerings and their
 *  reference lists. A page that fails keeps the rows of its last good parse.
 *  Runs take turns, so each reads a catalog page at least as new as the last. */
export const parseOfferings = Effect.fn("parseOfferings")(function* () {
	const store = yield* OfferingStore;

	yield* store.lockParse;

	const catalogPage = yield* store.latestCatalogPage;

	if (catalogPage === undefined) {
		yield* Effect.logWarning("No catalog page stored, so no filter ids");
	}

	const filters = catalogFiltersOf(catalogPage ?? "");
	const missing = missingFilters(filters);

	if (catalogPage !== undefined && missing.length > 0) {
		yield* Effect.logWarning("Catalog filters have no options", { missing });
	}

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
		const written = yield* Effect.exit(store.write(rows));

		if (Exit.isSuccess(written)) {
			parsed += pages.length;
		} else {
			failed.set("store", (failed.get("store") ?? 0) + pages.length);
			yield* Effect.logError("Offering batch failed to store", {
				first_snapshot_id: String(ids[0]),
				last_snapshot_id: String(ids.at(-1)),
				error: storeFailureOf(written.cause),
			});
		}
	}

	const report: ParseReport = {
		parsed,
		failed: Array.from(failed, ([reason, pages]) => ({ reason, pages })),
		missing,
	};

	yield* Effect.logInfo("Offerings parsed", report);

	return report;
}, Effect.scoped);
