import { Cause, Effect, Schema } from "effect";
import {
	catalogPath,
	parseAcademicYears,
	parseCatalogPage,
	parseCatalogPath,
} from "../saz/catalog.ts";
import { SazClient, type SazSignInFailed } from "../saz/SazClient.ts";
import {
	type ClaimedPage,
	CrawlStore,
	type KindTally,
	type OpenRun,
	type QueuedPage,
} from "./CrawlStore.ts";
import { type Snapshot, snapshotOf } from "./snapshot.ts";

const TRANSPORT_ERROR = "transport error";

/** Why a page failed, as stored on it: an HTTP status or `TRANSPORT_ERROR`. */
export class PageFailed extends Schema.TaggedError<PageFailed>()("PageFailed", {
	reason: Schema.String,
}) {}

export const pageFailedOf = (status: number): PageFailed =>
	new PageFailed({
		reason: status === 0 ? TRANSPORT_ERROR : `HTTP ${status}`,
	});

/** How a run reads its pages. An error other than `PageFailed`, such as a
 *  failed sign-in, fails the run. */
export interface PageSource<E> {
	readonly visit: (page: ClaimedPage) => Effect.Effect<
		{
			readonly snapshot: Snapshot;
			readonly next: ReadonlyArray<QueuedPage>;
		},
		PageFailed | E
	>;
	/** Whether failed pages of this kind fail the whole run. */
	readonly failsRun: (tally: KindTally) => boolean;
}

/** The catalog's year filter listed nothing, so its markup likely changed. */
export class NoAcademicYears extends Schema.TaggedError<NoAcademicYears>()(
	"NoAcademicYears",
	{},
) {}

const SAZ_SOURCE = "saz-courses";

/** `2025` is the academic year 2025-26, as in the САЗ catalog filter. */
export const sourcePartOf = (year: number): string =>
	`${SAZ_SOURCE}:${year}-${String(year + 1).slice(2)}`;

/** The pages a catalog page leads to: the other catalog pages (from page 1
 *  only, which carries the pager) and each listed course with its students. */
const linkedPages = (
	page: ClaimedPage,
	body: string,
): ReadonlyArray<QueuedPage> => {
	if (page.kind !== "catalog") return [];

	const catalog = parseCatalogPage(body);
	const { year, page: number } = parseCatalogPath(page.path);

	const otherCatalogPages =
		number === 1
			? Array.from({ length: catalog.lastPage - 1 }, (_, index) => ({
					kind: "catalog" as const,
					path: catalogPath(year, index + 2),
				}))
			: [];

	return [
		...otherCatalogPages,
		...catalog.codes.flatMap((code) => [
			{ kind: "course" as const, path: `/course/${code}` },
			{ kind: "students" as const, path: `/course/${code}/students` },
		]),
	];
};

/** Works through one run's queue. A page that fails is marked failed and the
 *  run goes on; a failed sign-in or a page `source.failsRun` names fails the run. */
export const crawlRun = Effect.fn("crawlRun")(function* <E>(
	run: OpenRun,
	source: PageSource<E>,
) {
	const store = yield* CrawlStore;

	const fail = (page: ClaimedPage, error: string) =>
		store
			.fail(page, error)
			.pipe(
				Effect.andThen(
					Effect.logWarning("Page failed", { path: page.path, error }),
				),
			);

	const visit = (page: ClaimedPage) =>
		source.visit(page).pipe(
			Effect.flatMap(({ snapshot, next }) =>
				store.complete(run.id, page, snapshot, next),
			),
			Effect.catchIf(Schema.is(PageFailed), ({ reason }) => fail(page, reason)),
		);

	const drain = Effect.gen(function* () {
		let page = yield* store.claim(run.id);

		while (page !== undefined) {
			yield* visit(page);
			page = yield* store.claim(run.id);
		}
	});

	// A transport error that outlasts the client's retries is a network blip and
	// gets one more pass; a САЗ 500 repeats on every try, so it does not.
	const crawl = drain.pipe(
		Effect.andThen(store.requeue(run.id, TRANSPORT_ERROR)),
		Effect.andThen((requeued) => (requeued > 0 ? drain : Effect.void)),
	);

	const finish = (crashed: boolean) =>
		Effect.gen(function* () {
			const report = yield* store.report(run.id);

			const status =
				crashed || report.pages.some(source.failsRun) ? "failed" : "succeeded";

			yield* store.finishRun(run.id, status, report);

			yield* Effect.logInfo("Run finished", report).pipe(
				Effect.annotateLogs({
					run_id: String(run.id),
					source_part: run.sourcePart,
					status,
				}),
			);

			return { sourcePart: run.sourcePart, status, report };
		});

	yield* Effect.logInfo("Run started").pipe(
		Effect.annotateLogs({
			run_id: String(run.id),
			source_part: run.sourcePart,
		}),
	);

	// An interrupted run stays `running`, so the next start resumes it.
	return yield* crawl.pipe(
		Effect.tapCause((cause) =>
			Cause.hasInterruptsOnly(cause) ? Effect.void : finish(true),
		),
		Effect.andThen(finish(false)),
	);
});

/** Crawls every academic year the catalog offers, one run per year. Runs that
 *  a crash left open are resumed instead, so finished pages are not fetched again. */
export const crawlAllYears = Effect.fn("crawlAllYears")(function* () {
	const store = yield* CrawlStore;
	const saz = yield* SazClient;
	const resumed = yield* store.openRuns(SAZ_SOURCE);

	const source: PageSource<SazSignInFailed> = {
		visit: (page) =>
			saz.get(page.path).pipe(
				Effect.map((body) => ({
					snapshot: snapshotOf(body),
					next: linkedPages(page, body),
				})),
				Effect.catchTags({
					SazRequestFailed: ({ status }) => Effect.fail(pageFailedOf(status)),
					SazSignedOut: () =>
						Effect.fail(
							new PageFailed({ reason: "signed out after a fresh sign-in" }),
						),
				}),
			),
		// A failed catalog page hides the courses it lists.
		failsRun: (tally) => tally.kind === "catalog" && tally.failed > 0,
	};

	const startRuns = Effect.gen(function* () {
		const years = parseAcademicYears(yield* saz.get("/course/catalog"));

		if (years.length === 0) return yield* new NoAcademicYears();

		return yield* Effect.forEach(years, (year) =>
			store.startRun(sourcePartOf(year), [
				{ kind: "catalog", path: catalogPath(year, 1) },
			]),
		);
	});

	const runs = resumed.length > 0 ? resumed : yield* startRuns;

	yield* Effect.logInfo("Crawl started", {
		runs: runs.length,
		resumed: resumed.length > 0,
	});

	const results = yield* Effect.forEach(runs, (run) => crawlRun(run, source));

	yield* Effect.logInfo(
		"Crawl finished",
		results.map(({ sourcePart, status, report }) => ({
			sourcePart,
			status,
			seconds: report.seconds,
			done: report.pages.reduce((sum, tally) => sum + tally.done, 0),
			failed: report.pages.reduce((sum, tally) => sum + tally.failed, 0),
			stored: report.pages.reduce((sum, tally) => sum + tally.stored, 0),
		})),
	);
});
