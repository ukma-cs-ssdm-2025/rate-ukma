import { Clock, DateTime, Duration, Effect } from "effect";

/** The steps the crawl loop runs. `nextWait` takes the time of this worker's
 *  last try, if any; `crawl` succeeds with `false` after a failed sign-in. */
export interface CrawlSteps<RWait, RCrawl, RParse> {
	readonly nextWait: (
		triedAt: number | undefined,
	) => Effect.Effect<Duration.Duration, never, RWait>;
	readonly crawl: Effect.Effect<boolean, never, RCrawl>;
	readonly parse: Effect.Effect<void, never, RParse>;
}

/** Crawls whenever `nextWait` says one is due and parses after each, until a
 *  sign-in fails: another try would send the password again. */
export const crawlLoop = Effect.fnUntraced(function* <RWait, RCrawl, RParse>({
	nextWait,
	crawl,
	parse,
}: CrawlSteps<RWait, RCrawl, RParse>) {
	// A restart between a crawl and its parse would leave the stored pages
	// unapplied until the next crawl.
	if (!Duration.isZero(yield* nextWait(undefined))) yield* parse;

	let triedAt: number | undefined;

	while (true) {
		const wait = yield* nextWait(triedAt);

		if (!Duration.isZero(wait)) {
			const at = DateTime.addDuration(yield* DateTime.now, wait);

			yield* Effect.logInfo("Next crawl scheduled", {
				at: DateTime.formatIso(at),
			});
			yield* Effect.sleep(wait);
		}

		triedAt = yield* Clock.currentTimeMillis;

		const signedIn = yield* crawl;

		yield* parse;

		if (!signedIn) {
			return yield* Effect.logError(
				"Crawling stopped until the worker restarts: the САЗ sign-in failed",
			);
		}
	}
});
