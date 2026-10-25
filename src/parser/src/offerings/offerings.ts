import { createHash } from "node:crypto";
import {
	Array as Arr,
	Cause,
	Clock,
	Effect,
	Exit,
	Option,
	Record as Rec,
	Result,
	Schema,
	Struct,
} from "effect";
import { SqlError } from "effect/sql";
import { type ChangeCount, mergeChangeCounts } from "../changes/ChangeLog.ts";
import { parseFilterOptions } from "../saz/catalog.ts";
import {
	Level,
	type ParsedOffering,
	parseCoursePage,
} from "../saz/coursePage.ts";
import {
	type OfferingRows,
	OfferingStore,
	type ParseFailure,
	type ParseReport,
	type ParseTrigger,
	type StoredProgramme,
} from "./OfferingStore.ts";

const BATCH_SIZE = 500;

/** Postgres refused at least one batch, so its pages kept their older rows. */
export class OfferingsNotStored extends Schema.TaggedError<OfferingsNotStored>()(
	"OfferingsNotStored",
	{ pages: Schema.Number },
) {}

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

type OfferingRow = OfferingRows["offerings"][number];

// By code unit, not locale, so every runtime sorts and hashes alike.
const byKey =
	<T>(key: (row: T) => string) =>
	(a: T, b: T) =>
		key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;

/** Entries by key, so the hash does not depend on the order a parser builds
 *  the fields in. */
const sortedEntries = <T extends object>(row: T) =>
	Object.entries(row).sort(byKey(([key]) => key));

/** SHA-256 of what a reader gets for one offering: the card's columns and its
 *  sorted terms and programmes, without the snapshot it came from. A row whose
 *  hash did not change keeps its change number. */
export const rowHashOf = (
	card: Omit<OfferingRow, "snapshotId" | "rowHash">,
	terms: OfferingRows["offeringTerms"],
	programmes: OfferingRows["offeringProgrammes"],
): string =>
	createHash("sha256")
		.update(
			JSON.stringify([
				sortedEntries(card),
				[...terms].sort(byKey(({ termCode }) => termCode)).map(sortedEntries),
				[...programmes]
					.sort(byKey(({ level, name }) => `${level} ${name}`))
					.map(sortedEntries),
			]),
		)
		.digest("hex");

const rowsOfPage = (
	{ snapshotId, offering: { terms, programmes, ...card } }: ParsedPage,
	filters: CatalogFilters,
	stored: ReadonlySet<string>,
) => {
	const offeringTerms = terms.map(({ season, ...term }) => ({
		...term,
		sazCode: card.sazCode,
		termCode: termCode(card.academicYear, season),
	}));

	const resolved = programmes.map(({ name, kind }) => ({
		kind,
		programme: programmeOf(name, card.level, filters, stored),
	}));

	const offeringProgrammes = resolved.map(
		({ kind, programme: { name, level } }) => ({
			sazCode: card.sazCode,
			name,
			level,
			kind,
		}),
	);

	return {
		offering: {
			...card,
			snapshotId: String(snapshotId),
			rowHash: rowHashOf(card, offeringTerms, offeringProgrammes),
		},
		offeringTerms,
		offeringProgrammes,
		programmes: resolved.map(({ programme }) => programme),
	};
};

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

	const pageRows = pages.map((page) => rowsOfPage(page, filters, stored));

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
			pageRows.flatMap(({ programmes }) => programmes),
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
		offerings: pageRows.map(({ offering }) => offering),
		offeringTerms: pageRows.flatMap(({ offeringTerms }) => offeringTerms),
		offeringProgrammes: pageRows.flatMap(
			({ offeringProgrammes }) => offeringProgrammes,
		),
	};
};

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
 *  reference lists, and records the parse with the rows it numbered. A page
 *  that fails keeps the rows of its last good parse, and the failure is
 *  recorded with its snapshot. Runs take turns, so each reads a catalog page
 *  at least as new as the last. */
export const parseOfferings = Effect.fn("parseOfferings")(function* (
	trigger: ParseTrigger,
) {
	const store = yield* OfferingStore;

	yield* store.lockParse;

	const startedAt = yield* Clock.currentTimeMillis;
	const parseId = yield* store.startParse(trigger);
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
	let changes: ReadonlyArray<ChangeCount> = [];
	let parsed = 0;

	for (const ids of Arr.chunksOf(yield* store.latestCoursePages, BATCH_SIZE)) {
		const pages: Array<ParsedPage & { readonly path: string }> = [];
		const failures: Array<ParseFailure> = [];

		for (const page of yield* store.coursePages(ids)) {
			const result = parseCoursePage(
				page.content,
				page.path.slice("/course/".length),
			);

			if (Result.isSuccess(result)) {
				pages.push({
					snapshotId: page.id,
					path: page.path,
					offering: result.success,
				});
				continue;
			}

			const { reason } = result.failure;

			failures.push({ snapshotId: page.id, path: page.path, reason });
			yield* Effect.logWarning("Course page failed to parse", {
				path: page.path,
				snapshot_id: String(page.id),
				reason,
			});
		}

		const rows = offeringRowsOf(pages, filters, yield* store.programmes);

		// A batch the database rejects keeps its last good rows, like a page that
		// fails to parse, and the run goes on to the next batch.
		const written = yield* Effect.exit(store.write(rows, parseId));

		if (Exit.isSuccess(written)) {
			parsed += pages.length;
			changes = mergeChangeCounts([...changes, ...written.value]);
		} else {
			failures.push(
				...pages.map(({ snapshotId, path }) => ({
					snapshotId,
					path,
					reason: "store",
				})),
			);
			yield* Effect.logError("Offering batch failed to store", {
				first_snapshot_id: String(ids[0]),
				last_snapshot_id: String(ids.at(-1)),
				error: storeFailureOf(written.cause),
			});
		}

		for (const { reason } of failures) {
			failed.set(reason, (failed.get(reason) ?? 0) + 1);
		}

		yield* store.recordFailures(parseId, failures);
	}

	const report: ParseReport = {
		seconds: Math.round(((yield* Clock.currentTimeMillis) - startedAt) / 1000),
		parsed,
		failed: Array.from(failed, ([reason, pages]) => ({ reason, pages })),
		changes,
		missing,
	};

	yield* store.finishParse(parseId, report);
	yield* Effect.logInfo("Offerings parsed", report).pipe(
		Effect.annotateLogs({ parse_id: String(parseId), trigger }),
	);

	return report;
}, Effect.scoped);

/** A reparse with a refused batch fails, so its Job does not show Completed. */
export const reparseOfferings = Effect.gen(function* () {
	const report = yield* parseOfferings("reparse");
	const refused = report.failed.find(({ reason }) => reason === "store");

	if (refused !== undefined) {
		return yield* new OfferingsNotStored({ pages: refused.pages });
	}

	return report;
});
