import { Cause, Clock, Effect } from "effect";
import { catalogPath, parseCatalogPage } from "../saz/catalog.ts";
import { SazClient } from "../saz/SazClient.ts";
import { type ClaimedPage, CrawlStore, type QueuedPage } from "./CrawlStore.ts";
import { snapshotOf } from "./snapshot.ts";

/** `2025` is the academic year 2025-26, as in the САЗ catalog filter. */
export const sourcePartOf = (year: number): string =>
	`saz-courses:${year}-${String(year + 1).slice(2)}`;

/** The pages a catalog page leads to: the other catalog pages (from page 1
 *  only, which carries the pager) and each listed course with its students. */
const linkedPages = (
	year: number,
	page: ClaimedPage,
	body: string,
): ReadonlyArray<QueuedPage> => {
	if (page.kind !== "catalog") return [];
	const catalog = parseCatalogPage(body);

	const otherCatalogPages =
		page.path === catalogPath(year, 1)
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

/** Crawls one academic year into page snapshots. A page that fails is marked
 *  failed and the run goes on; a failed sign-in or catalog page fails the run. */
export const crawlYear = Effect.fn("crawlYear")(function* (year: number) {
	const store = yield* CrawlStore;
	const saz = yield* SazClient;
	const started = yield* Clock.currentTimeMillis;
	const sourcePart = sourcePartOf(year);

	const runId = yield* store.startRun(sourcePart, {
		kind: "catalog",
		path: catalogPath(year, 1),
	});

	yield* Effect.logInfo("Run started").pipe(
		Effect.annotateLogs({ run_id: String(runId), source_part: sourcePart }),
	);

	const visit = (page: ClaimedPage) =>
		saz.get(page.path).pipe(
			Effect.flatMap((body) =>
				store.complete(
					runId,
					page,
					snapshotOf(body),
					linkedPages(year, page, body),
				),
			),
			Effect.catchTags({
				SazRequestFailed: (error) =>
					store.fail(
						page,
						error.status === 0 ? "transport error" : `HTTP ${error.status}`,
					),
				SazSignedOut: () =>
					store.fail(page, "signed out after a fresh sign-in"),
			}),
		);

	const crawl = Effect.gen(function* () {
		let page = yield* store.claim(runId);

		while (page !== undefined) {
			yield* visit(page);
			page = yield* store.claim(runId);
		}
	});

	const finish = (crashed: boolean) =>
		Effect.gen(function* () {
			const pages = yield* store.tally(runId);

			// A failed catalog page hides the courses it lists.
			const status =
				crashed ||
				pages.some((tally) => tally.kind === "catalog" && tally.failed > 0)
					? "failed"
					: "succeeded";

			const now = yield* Clock.currentTimeMillis;

			const report = {
				sourcePart,
				seconds: Math.round((now - started) / 1000),
				pages,
			};

			yield* store.finishRun(runId, status, report);

			yield* Effect.logInfo("Run finished", report).pipe(
				Effect.annotateLogs({ run_id: String(runId), status }),
			);
		});

	// An interrupted run stays `running`, so a restart can tell it never ended.
	yield* crawl.pipe(
		Effect.tapCause((cause) =>
			Cause.hasInterruptsOnly(cause) ? Effect.void : finish(true),
		),
		Effect.andThen(finish(false)),
	);
});
