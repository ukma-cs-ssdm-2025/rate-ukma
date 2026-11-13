import { Cause, Clock, Config, Duration, Effect, Result, Schema } from "effect";
import {
	catalogPath,
	catalogProblem,
	parseAcademicYears,
	parseCatalogPage,
	parseCatalogPath,
} from "../saz/catalog.ts";
import { CRAWL_LOCK } from "../db/locks.ts";
import {
	SazClient,
	type SazSignInFailed,
	type SazRateLimited,
} from "../saz/SazClient.ts";
import {
	type ClaimedPage,
	CrawlStore,
	type LastCrawl,
	type OpenRun,
	type PageCounts,
	type QueuedPage,
} from "./CrawlStore.ts";
import { type Snapshot, snapshotOf } from "./snapshot.ts";

/** The `error` a failed request leaves on its page. */
const requestError = (status: number): string =>
	status === 0 ? "transport error" : `HTTP ${status}`;

/** Why a page failed, as stored on it. */
export class PageFailed extends Schema.TaggedError<PageFailed>()("PageFailed", {
	reason: Schema.String,
}) {}

export const pageFailedOf = (status: number): PageFailed =>
	new PageFailed({ reason: requestError(status) });

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
	/** Whether these failed pages fail the whole run. */
	readonly failsRun: (counts: PageCounts) => boolean;
}

/** Failures a later try may not repeat. A САЗ 500 repeats for the same page,
 *  so it is not one of them. */
const PASSING_ERRORS = [0, 429, 502, 503, 504].map(requestError);

/** The catalog's year filter listed nothing, so its markup likely changed. */
export class NoAcademicYears extends Schema.TaggedError<NoAcademicYears>()(
	"NoAcademicYears",
	{},
) {}

/** Another worker holds the crawl lock. */
export class CrawlAlreadyRunning extends Schema.TaggedError<CrawlAlreadyRunning>()(
	"CrawlAlreadyRunning",
	{},
) {}

const SAZ_SOURCE = "saz-courses";

/** `2025` is the academic year 2025-26, as in the САЗ catalog filter. */
export const sourcePartOf = (year: number): string =>
	`${SAZ_SOURCE}:${year}-${String(year + 1).slice(2)}`;

/** The inverse of `sourcePartOf`: `saz-courses:2025-26` is 2025. */
export const academicYearOf = (sourcePart: string): number | undefined => {
	const year = /^saz-courses:(\d{4})-\d{2}$/.exec(sourcePart)?.[1];

	return year === undefined ? undefined : Number(year);
};

/** The pages a catalog page leads to: the other catalog pages (from page 1
 *  only, which carries the pager) and each listed course with its students;
 *  or why the catalog page cannot be trusted. */
const linkedPages = (
	page: ClaimedPage,
	body: string,
): Result.Result<ReadonlyArray<QueuedPage>, string> => {
	if (page.kind !== "catalog") return Result.succeed([]);

	const catalog = parseCatalogPage(body);
	const { year, page: number } = parseCatalogPath(page.path);
	const problem = catalogProblem(catalog, number);

	if (problem !== undefined) return Result.fail(problem);

	const otherCatalogPages =
		number === 1
			? Array.from({ length: catalog.lastPage - 1 }, (_, index) => ({
					kind: "catalog" as const,
					path: catalogPath(year, index + 2),
				}))
			: [];

	return Result.succeed([
		...otherCatalogPages,
		...catalog.codes.flatMap((code) => [
			{ kind: "course" as const, path: `/course/${code}` },
			{ kind: "students" as const, path: `/course/${code}/students` },
		]),
	]);
};

/** Works through one run's queue. A page that fails is marked failed and the
 *  run goes on; an error of the source, such as a failed sign-in or a long
 *  rate limit, or a page `source.failsRun` names fails the run. A crash, such
 *  as a lost database, leaves the run `running` to resume later. */
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

	// A passing failure that outlasts the client's retries gets one more pass.
	const crawl = drain.pipe(
		Effect.andThen(store.requeue(run.id, PASSING_ERRORS)),
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

	// An error of the source ends the run here as failed, leaving
	// its other pages unfetched. An interrupted or crashed run stays `running`,
	// so the next start resumes it.
	return yield* crawl.pipe(
		Effect.tapCause((cause) =>
			Cause.hasFails(cause) ? finish(true) : Effect.void,
		),
		Effect.andThen(finish(false)),
	);
});

/** How many of the latest academic years every crawl covers: the current one
 *  and the one before it, or the next once САЗ lists it. Older years change
 *  rarely. */
const RECENT_YEARS = 2;

/** The years one crawl covers: the `RECENT_YEARS` latest, and the older year
 *  crawled longest ago, never crawled first, so each older year comes round
 *  in turn. `secondsAgo` maps a year to the time since its last run started. */
export const yearsToCrawl = (
	years: ReadonlyArray<number>,
	secondsAgo: ReadonlyMap<number, number>,
): ReadonlyArray<number> => {
	const newestFirst = [...years].sort((a, b) => b - a);
	const recent = newestFirst.slice(0, RECENT_YEARS);
	const ago = (year: number) => secondsAgo.get(year) ?? Infinity;

	const [older] = newestFirst
		.slice(RECENT_YEARS)
		.sort((a, b) => ago(b) - ago(a) || a - b);

	return [...recent, ...(older === undefined ? [] : [older])].sort(
		(a, b) => a - b,
	);
};

/** Crawls the years `yearsToCrawl` picks from the catalog, one run per year.
 *  Runs that a crash left open are resumed instead, so finished pages are not
 *  fetched again. */
export const crawlYears = Effect.fn("crawlYears")(function* () {
	const store = yield* CrawlStore;
	const saz = yield* SazClient;

	if (!(yield* store.lockCrawl(CRAWL_LOCK))) {
		return yield* new CrawlAlreadyRunning();
	}

	const resumed = yield* store.openRuns(SAZ_SOURCE);

	const source: PageSource<SazSignInFailed | SazRateLimited> = {
		visit: (page) =>
			saz.get(page.path).pipe(
				Effect.catchTag("SazRequestFailed", ({ status }) =>
					Effect.fail(pageFailedOf(status)),
				),
				Effect.flatMap((body) =>
					Result.match(linkedPages(page, body), {
						onFailure: (problem) =>
							Effect.fail(new PageFailed({ reason: problem })),
						onSuccess: (next) =>
							Effect.succeed({ snapshot: snapshotOf(body), next }),
					}),
				),
			),
		// A failed catalog page hides the courses it lists.
		failsRun: (counts) => counts.kind === "catalog" && counts.failed > 0,
	};

	const startRuns = Effect.gen(function* () {
		const years = parseAcademicYears(yield* saz.get("/course/catalog"));

		if (years.length === 0) return yield* new NoAcademicYears();

		const secondsAgo = new Map(
			(yield* store.lastStarts(SAZ_SOURCE)).flatMap(
				({ sourcePart, secondsAgo }) => {
					const year = academicYearOf(sourcePart);

					return year === undefined ? [] : [[year, secondsAgo] as const];
				},
			),
		);

		return yield* store.startRuns(
			yearsToCrawl(years, secondsAgo).map((year) => ({
				sourcePart: sourcePartOf(year),
				pages: [{ kind: "catalog", path: catalogPath(year, 1) }],
			})),
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
			done: report.pages.reduce((sum, counts) => sum + counts.done, 0),
			failed: report.pages.reduce((sum, counts) => sum + counts.failed, 0),
			stored: report.pages.reduce((sum, counts) => sum + counts.stored, 0),
		})),
	);
}, Effect.scoped);

/** The time from the start of one САЗ crawl to the start of the next. A crawl
 *  that runs longer is followed by the next one right away. At least an hour,
 *  so a crawl that fails fast does not ask САЗ again at once. */
export const CrawlInterval = Config.schema(
	Schema.DurationFromString.check(
		Schema.makeIsGreaterThanOrEqualTo({ order: Duration.Order })(
			Duration.hours(1),
		),
	),
	"CRAWL_INTERVAL",
).pipe(Config.withDefault(Duration.hours(24)));

/** How long a crawl this worker left open, such as through a database outage
 *  its retries did not outlast, waits before it resumes. */
const RESUME_AFTER = Duration.hours(1);

/** How long to wait before the next crawl: `interval` after the latest start,
 *  the one stored or this worker's own try, since a try that fails before it
 *  opens a run stores none. A crawl a restart left open resumes at once, and
 *  one this worker left open `RESUME_AFTER` its try. */
export const crawlDelay = (
	interval: Duration.Duration,
	last: LastCrawl | undefined,
	sinceTry: Duration.Duration | undefined,
): Duration.Duration => {
	const since = Duration.min(
		last?.ago ?? Duration.infinity,
		sinceTry ?? Duration.infinity,
	);

	const gap = last?.open
		? sinceTry === undefined
			? Duration.zero
			: RESUME_AFTER
		: interval;

	return Duration.max(Duration.zero, Duration.subtract(gap, since));
};

/** The wait before the next САЗ crawl, from the runs stored and `triedAt`,
 *  when this worker last tried one. */
export const untilNextCrawl = Effect.fn("untilNextCrawl")(function* (
	interval: Duration.Duration,
	triedAt: number | undefined,
) {
	const store = yield* CrawlStore;
	const now = yield* Clock.currentTimeMillis;

	const sinceTry =
		triedAt === undefined ? undefined : Duration.millis(now - triedAt);

	return crawlDelay(interval, yield* store.lastCrawl(SAZ_SOURCE), sinceTry);
});
