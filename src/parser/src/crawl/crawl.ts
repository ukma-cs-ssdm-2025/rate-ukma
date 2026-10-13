import { Cause, Effect } from "effect";
import {
	catalogPath,
	parseAcademicYears,
	parseCatalogPage,
	parseCatalogPath,
} from "../saz/catalog.ts";
import { SazClient } from "../saz/SazClient.ts";
import {
	type ClaimedPage,
	CrawlStore,
	type OpenRun,
	type QueuedPage,
} from "./CrawlStore.ts";
import { snapshotOf } from "./snapshot.ts";

const TRANSPORT_ERROR = "transport error";

/** `2025` is the academic year 2025-26, as in the САЗ catalog filter. */
export const sourcePartOf = (year: number): string =>
	`saz-courses:${year}-${String(year + 1).slice(2)}`;

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
 *  run goes on; a failed sign-in or catalog page fails the run. */
const crawlRun = Effect.fn("crawlRun")(function* (run: OpenRun) {
	const store = yield* CrawlStore;
	const saz = yield* SazClient;

	const fail = (page: ClaimedPage, error: string) =>
		store
			.fail(page, error)
			.pipe(
				Effect.andThen(
					Effect.logWarning("Page failed", { path: page.path, error }),
				),
			);

	const visit = (page: ClaimedPage) =>
		saz.get(page.path).pipe(
			Effect.flatMap((body) =>
				store.complete(run.id, page, snapshotOf(body), linkedPages(page, body)),
			),
			Effect.catchTags({
				SazRequestFailed: (error) =>
					fail(
						page,
						error.status === 0 ? TRANSPORT_ERROR : `HTTP ${error.status}`,
					),
				SazSignedOut: () => fail(page, "signed out after a fresh sign-in"),
			}),
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

			// A failed catalog page hides the courses it lists.
			const status =
				crashed ||
				report.pages.some(
					(tally) => tally.kind === "catalog" && tally.failed > 0,
				)
					? "failed"
					: "succeeded";

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
	const resumed = yield* store.openRuns;

	const runs =
		resumed.length > 0
			? resumed
			: yield* Effect.forEach(
					parseAcademicYears(yield* saz.get("/course/catalog")),
					(year) =>
						store.startRun(sourcePartOf(year), {
							kind: "catalog",
							path: catalogPath(year, 1),
						}),
				);

	yield* Effect.logInfo("Crawl started", {
		runs: runs.length,
		resumed: resumed.length > 0,
	});

	const results = yield* Effect.forEach(runs, crawlRun);

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
