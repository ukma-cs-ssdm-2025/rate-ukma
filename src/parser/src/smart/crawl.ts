import { DateTime, Effect, Schema } from "effect";
import {
	CrawlAlreadyRunning,
	crawlRun,
	PageFailed,
	type PageSource,
	pageFailedOf,
} from "../crawl/crawl.ts";
import { CrawlStore, type QueuedPage } from "../crawl/CrawlStore.ts";
import { snapshotOfJson } from "../crawl/snapshot.ts";
import { SMART_CRAWL_LOCK } from "../db/locks.ts";
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
const smartSourcePartOf = (day: DateTime.DateTime): string =>
	`${SMART_SOURCE}:${DateTime.formatIsoDate(day)}`;

/** A run ended `failed`, so a scheduled `crawl-smart` exits non-zero. */
export class SmartCrawlFailed extends Schema.TaggedError<SmartCrawlFailed>()(
	"SmartCrawlFailed",
	{ sourcePart: Schema.String },
) {}

/** Fetches the smart.ukma lists into one run, or finishes the run a crash
 *  left open, which keeps the day it started under. Any failed list fails
 *  the run. */
export const crawlSmart = Effect.fn("crawlSmart")(function* () {
	const store = yield* CrawlStore;
	const smart = yield* SmartClient;

	if (!(yield* store.lockCrawl(SMART_CRAWL_LOCK))) {
		return yield* new CrawlAlreadyRunning();
	}

	const resumed = yield* store.openRuns(SMART_SOURCE);

	const runs =
		resumed.length > 0
			? resumed
			: yield* store.startRuns([
					{
						sourcePart: smartSourcePartOf(yield* DateTime.now),
						pages: SMART_PAGES,
					},
				]);

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
		failsRun: (counts) => counts.failed > 0,
	};

	const results = yield* Effect.forEach(runs, (run) => crawlRun(run, source));
	const failed = results.find(({ status }) => status === "failed");

	if (failed !== undefined) {
		return yield* new SmartCrawlFailed({ sourcePart: failed.sourcePart });
	}

	return results;
}, Effect.scoped);
