import { DateTime, Effect } from "effect";
import {
	crawlRun,
	PageFailed,
	type PageSource,
	pageFailedOf,
} from "../crawl/crawl.ts";
import { CrawlStore, type QueuedPage } from "../crawl/CrawlStore.ts";
import { snapshotOfJson } from "../crawl/snapshot.ts";
import { SmartClient, type SmartSignInFailed } from "./SmartClient.ts";

const SMART_SOURCE = "smart-ukma";

/** Each list comes whole in one reply; the API has no paging. */
export const SMART_PAGES: ReadonlyArray<QueuedPage> = [
	{ kind: "smart_departments", path: "/api/department" },
	{ kind: "smart_teachers", path: "/api/teacher" },
	{ kind: "smart_disciplines", path: "/api/discipline" },
	{ kind: "smart_teacher_disciplines", path: "/api/teacher/disciplines" },
];

/** smart.ukma lists have no academic year, so a run is named by its day. */
export const smartSourcePartOf = (day: DateTime.DateTime): string =>
	`${SMART_SOURCE}:${DateTime.formatIsoDate(day)}`;

/** Fetches the smart.ukma lists into one run, or finishes the run a crash
 *  left open. Any failed list fails the run. */
export const crawlSmart = Effect.fn("crawlSmart")(function* () {
	const store = yield* CrawlStore;
	const smart = yield* SmartClient;
	const resumed = yield* store.openRuns(SMART_SOURCE);

	const runs =
		resumed.length > 0
			? resumed
			: [
					yield* store.startRun(
						smartSourcePartOf(yield* DateTime.now),
						SMART_PAGES,
					),
				];

	const source: PageSource<SmartSignInFailed> = {
		visit: (page) =>
			smart.get(page.path).pipe(
				Effect.map((json) => ({ snapshot: snapshotOfJson(json), next: [] })),
				Effect.catchTags({
					SmartRequestFailed: ({ status }) => Effect.fail(pageFailedOf(status)),
					SmartNotJson: () =>
						Effect.fail(new PageFailed({ reason: "not JSON" })),
				}),
			),
		failsRun: (tally) => tally.failed > 0,
	};

	return yield* Effect.forEach(runs, (run) => crawlRun(run, source));
});
