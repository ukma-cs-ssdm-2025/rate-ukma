import { assert, describe, it, layer } from "@effect/vitest";
import { Duration, Effect, Exit, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { TestDatabase, testDatabaseUrl } from "../db/testing.ts";
import { catalogPath } from "../saz/catalog.ts";
import {
	type SazError,
	SazClient,
	SazRateLimited,
	SazRequestFailed,
	SazSignInFailed,
} from "../saz/SazClient.ts";
import { crawlSmart, SMART_PAGES, SmartCrawlFailed } from "../smart/crawl.ts";
import { SmartClient, SmartRequestFailed } from "../smart/SmartClient.ts";
import {
	CrawlAlreadyRunning,
	crawlAllYears,
	crawlDelay,
	NoAcademicYears,
} from "./crawl.ts";
import {
	CrawlStore,
	type OpenRun,
	type PageCounts,
	PageKind,
	type QueuedPage,
	type RunReport,
} from "./CrawlStore.ts";

const card = (code: string) =>
	`<a class="btn btn-block btn-default" href="/course/${code}">Детальніше</a>`;

const YEARS = `<select id="coursefilter-academic_year" name="filter[academic_year][]" multiple>
<option value="2031">2031–2032</option>
<option value="2032">2032–2033</option>
</select>`;

const PAGER = `<li class="last"><a href="${catalogPath(2031, 2).replace("&", "&amp;")}" data-page="1">&raquo;</a></li>`;

/** The 2031-32 catalog, two pages long. 100004 is a master's course that is
 *  not recommended, so the catalog's default filters hide it. */
const CATALOG = [
	{ code: "100001", page: 1, level: "1", selected: "1" },
	{ code: "100002", page: 1, level: "1", selected: "1" },
	{ code: "100004", page: 1, level: "2", selected: "0" },
	{ code: "100003", page: 2, level: "1", selected: "1" },
];

/** Filters the catalog as САЗ does, falling back to `Бакалавр` and
 *  `рекомендовано` when the request leaves them out. */
const catalogPage = (path: string) => {
	const params = new URLSearchParams(path.slice(path.indexOf("?") + 1));

	const filter = (name: string) => {
		const values = params.getAll(`filter[${name}][]`);

		return values.length > 0 ? values : ["1"];
	};

	if (params.get("filter[academic_year][]") !== "2031") return undefined;

	const page = Number(params.get("page"));

	const listed = CATALOG.filter(
		(course) =>
			filter("level").includes(course.level) &&
			filter("selected").includes(course.selected),
	);

	const cards = listed.filter((course) => course.page === page);
	const before = listed.filter((course) => course.page < page).length;

	const summary = `<div class="summary">Показані <b>${before + 1}-${before + cards.length}</b> із <b>${listed.length}</b> записів.</div>`;

	return (
		summary +
		cards.map((course) => card(course.code)).join("") +
		(page === 1 ? PAGER : "")
	);
};

/** Course 100002 is gone and course 100003 drops the connection once; the
 *  2032-33 catalog does not load. */
const SAZ_PAGES = new Map([
	["/course/catalog", YEARS],
	["/course/100001", "<html>course 100001</html>"],
	["/course/100001/students", "[]"],
	["/course/100003", "<html>course 100003</html>"],
	["/course/100003/students", "[]"],
	["/course/100004", "<html>course 100004</html>"],
	["/course/100004/students", "[]"],
]);

/** The fake САЗ; `answers` replaces what it serves for some paths. */
const makeFakeSaz = (
	answers: Record<string, Effect.Effect<string, SazError>> = {},
) => {
	const fetched: Array<string> = [];

	const layer = Layer.succeed(SazClient, {
		get: (path) => {
			fetched.push(path);

			const answer = answers[path];

			if (answer) return answer;

			const body = path.startsWith("/course/catalog?")
				? catalogPage(path)
				: SAZ_PAGES.get(path);

			if (path === "/course/100003" && !fetched.slice(0, -1).includes(path)) {
				return Effect.fail(new SazRequestFailed({ path, status: 0 }));
			}

			return body === undefined
				? Effect.fail(new SazRequestFailed({ path, status: 404 }))
				: Effect.succeed(body);
		},
	});

	return { fetched, layer };
};

interface MemoryPage extends QueuedPage {
	readonly id: bigint;
	readonly runId: bigint;
	status: string;
	attempts: number;
	error?: string;
}

/** The run queue in memory; completing `crashOn` dies, as a lost database
 *  would. */
const makeMemoryStore = (crashOn?: string, locked = true) => {
	const runs: Array<OpenRun & { status: string }> = [];
	const pages: Array<MemoryPage> = [];
	const finished: Array<{ sourcePart: string; status: string }> = [];

	const queue = (runId: bigint, page: QueuedPage, status = "pending") => {
		if (!pages.some((row) => row.runId === runId && row.path === page.path)) {
			pages.push({
				...page,
				id: BigInt(pages.length + 1),
				runId,
				status,
				attempts: 0,
			});
		}
	};

	const mark = (id: bigint, status: string) =>
		Effect.sync(() => {
			const row = pages.find((page) => page.id === id);

			if (row) row.status = status;
		});

	const startRun = (sourcePart: string, queued: ReadonlyArray<QueuedPage>) =>
		Effect.sync(() => {
			const run = {
				id: BigInt(runs.length + 1),
				sourcePart,
				status: "running",
			};

			runs.push(run);
			queued.forEach((page) => queue(run.id, page));

			return { id: run.id, sourcePart };
		});

	const countsOf = (runId: bigint, kind: PageCounts["kind"]): PageCounts => {
		const ofKind = pages.filter(
			(page) => page.runId === runId && page.kind === kind,
		);

		return {
			kind,
			done: ofKind.filter((page) => page.status === "done").length,
			failed: ofKind.filter((page) => page.status === "failed").length,
			stored: 0,
		};
	};

	const report = (runId: bigint): RunReport => ({
		seconds: 0,
		pages: PageKind.literals.map((kind) => countsOf(runId, kind)),
		failures: [],
	});

	const layer = Layer.succeed(CrawlStore, {
		lockCrawl: () => Effect.succeed(locked),
		startRuns: (open) =>
			Effect.forEach(open, ({ sourcePart, pages }) =>
				startRun(sourcePart, pages),
			),
		openRuns: (source) =>
			Effect.sync(() => {
				const open = runs.flatMap(({ id, sourcePart, status }) =>
					status === "running" && sourcePart.startsWith(`${source}:`)
						? [{ id, sourcePart }]
						: [],
				);

				for (const page of pages) {
					if (
						page.status === "claimed" &&
						open.some(({ id }) => id === page.runId)
					) {
						page.status = "pending";
					}
				}

				return open;
			}),
		lastCrawl: () => Effect.succeed(undefined),
		claim: (runId) =>
			Effect.sync(() => {
				const next = pages.find(
					(page) => page.runId === runId && page.status === "pending",
				);

				if (next) {
					next.status = "claimed";
					next.attempts += 1;
				}

				return next;
			}),
		complete: (runId, page, _, next) =>
			(page.path === crashOn
				? Effect.die(new Error("connection lost"))
				: mark(page.id, "done")
			).pipe(
				Effect.andThen(
					Effect.sync(() => next.forEach((linked) => queue(runId, linked))),
				),
			),
		fail: (page, error) =>
			mark(page.id, "failed").pipe(
				Effect.andThen(
					Effect.sync(() => {
						const row = pages.find((queued) => queued.id === page.id);

						if (row) row.error = error;
					}),
				),
			),
		requeue: (runId, errors) =>
			Effect.sync(() => {
				const failed = pages.filter(
					(page) =>
						page.runId === runId &&
						page.status === "failed" &&
						errors.includes(page.error ?? "") &&
						page.attempts === 1,
				);

				for (const page of failed) page.status = "pending";

				return failed.length;
			}),
		report: (runId) => Effect.sync(() => report(runId)),
		finishRun: (runId, status) =>
			Effect.sync(() => {
				const run = runs.find((open) => open.id === runId);

				if (run) {
					run.status = status;
					finished.push({ sourcePart: run.sourcePart, status });
				}
			}),
	});

	return { pages, finished, queue, startRun, layer };
};

describe("crawlAllYears", () => {
	it.effect("crawls each year the catalog offers", () => {
		const store = makeMemoryStore();
		const saz = makeFakeSaz();

		return Effect.gen(function* () {
			yield* crawlAllYears();

			assert.deepStrictEqual(
				store.pages.map((page) => `${page.runId} ${page.status} ${page.path}`),
				[
					`1 done ${catalogPath(2031, 1)}`,
					`2 failed ${catalogPath(2032, 1)}`,
					`1 done ${catalogPath(2031, 2)}`,
					"1 done /course/100001",
					"1 done /course/100001/students",
					"1 failed /course/100002",
					"1 failed /course/100002/students",
					"1 done /course/100004",
					"1 done /course/100004/students",
					"1 done /course/100003",
					"1 done /course/100003/students",
				],
			);

			assert.deepStrictEqual(store.finished, [
				{ sourcePart: "saz-courses:2031-32", status: "succeeded" },
				{ sourcePart: "saz-courses:2032-33", status: "failed" },
			]);

			assert.deepStrictEqual(
				["/course/100002", "/course/100003"].map(
					(path) => saz.fetched.filter((fetched) => fetched === path).length,
				),
				[1, 2],
			);
		}).pipe(Effect.provide([store.layer, saz.layer]));
	});

	it.effect("finds the courses the catalog's default filters hide", () => {
		const store = makeMemoryStore();
		const saz = makeFakeSaz();

		return Effect.gen(function* () {
			yield* crawlAllYears();

			assert.includeMembers(saz.fetched, [
				"/course/100004",
				"/course/100004/students",
			]);
		}).pipe(Effect.provide([store.layer, saz.layer]));
	});

	it.effect("fails when the catalog offers no years", () => {
		const store = makeMemoryStore();

		const saz = Layer.succeed(SazClient, {
			get: () => Effect.succeed("<html></html>"),
		});

		return Effect.gen(function* () {
			const error = yield* Effect.flip(crawlAllYears());

			assert.instanceOf(error, NoAcademicYears);
			assert.deepStrictEqual(store.pages, []);
		}).pipe(Effect.provide([store.layer, saz]));
	});

	it.effect("resumes an open run without fetching its finished pages", () => {
		const store = makeMemoryStore();
		const saz = makeFakeSaz();

		return Effect.gen(function* () {
			const run = yield* store.startRun("saz-courses:2031-32", [
				{ kind: "catalog", path: catalogPath(2031, 1) },
			]);

			yield* Effect.sync(() => {
				for (const page of store.pages) page.status = "done";

				store.queue(run.id, { kind: "course", path: "/course/100001" }, "done");

				store.queue(
					run.id,
					{ kind: "students", path: "/course/100001/students" },
					"claimed",
				);
			});

			yield* crawlAllYears();

			assert.deepStrictEqual(saz.fetched, ["/course/100001/students"]);

			assert.deepStrictEqual(store.finished, [
				{ sourcePart: "saz-courses:2031-32", status: "succeeded" },
			]);
		}).pipe(Effect.provide([store.layer, saz.layer]));
	});

	it.effect("fails the run when the first catalog page lost its pager", () => {
		const store = makeMemoryStore();
		const first = catalogPath(2031, 1);

		const saz = makeFakeSaz({
			[first]: Effect.succeed(catalogPage(first)?.replace(PAGER, "") ?? ""),
		});

		return Effect.gen(function* () {
			yield* crawlAllYears();

			assert.deepStrictEqual(
				store.pages.map((page) => `${page.runId} ${page.status} ${page.path}`),
				[`1 failed ${first}`, `2 failed ${catalogPath(2032, 1)}`],
			);
			assert.strictEqual(store.finished[0]?.status, "failed");
		}).pipe(Effect.provide([store.layer, saz.layer]));
	});

	it.effect("fails the run and stops when the sign-in fails", () => {
		const store = makeMemoryStore();

		const saz = makeFakeSaz({
			"/course/100001": Effect.fail(
				new SazSignInFailed({ reason: "Microsoft error 50053" }),
			),
		});

		return Effect.gen(function* () {
			const exit = yield* Effect.exit(crawlAllYears());

			assert.isTrue(Exit.isFailure(exit));
			assert.deepStrictEqual(store.finished, [
				{ sourcePart: "saz-courses:2031-32", status: "failed" },
			]);
			assert.notInclude(saz.fetched, "/course/100001/students");
		}).pipe(Effect.provide([store.layer, saz.layer]));
	});

	it.effect("fails the run and stops when САЗ asks for a long wait", () => {
		const store = makeMemoryStore();

		const saz = makeFakeSaz({
			"/course/100001": Effect.fail(
				new SazRateLimited({ path: "/course/100001", retryAfterSeconds: 600 }),
			),
		});

		return Effect.gen(function* () {
			const exit = yield* Effect.exit(crawlAllYears());

			assert.isTrue(Exit.isFailure(exit));
			assert.deepStrictEqual(store.finished, [
				{ sourcePart: "saz-courses:2031-32", status: "failed" },
			]);
			assert.strictEqual(saz.fetched.at(-1), "/course/100001");
		}).pipe(Effect.provide([store.layer, saz.layer]));
	});

	it.effect("leaves the runs running when the database is lost", () => {
		const store = makeMemoryStore("/course/100001");
		const saz = makeFakeSaz();

		return Effect.gen(function* () {
			const exit = yield* Effect.exit(crawlAllYears());

			assert.isTrue(Exit.isFailure(exit));
			assert.deepStrictEqual(store.finished, []);
		}).pipe(Effect.provide([store.layer, saz.layer]));
	});

	it.effect("does not start while another crawl holds the lock", () => {
		const store = makeMemoryStore(undefined, false);
		const saz = makeFakeSaz();

		return Effect.gen(function* () {
			const error = yield* Effect.flip(crawlAllYears());

			assert.instanceOf(error, CrawlAlreadyRunning);
			assert.deepStrictEqual(saz.fetched, []);
		}).pipe(Effect.provide([store.layer, saz.layer]));
	});
});

describe("crawlDelay", () => {
	const DAY = Duration.hours(24);

	const hours = (delay: Duration.Duration) =>
		Duration.toMillis(delay) / 3_600_000;

	const finished = (hoursAgo: number) => ({
		secondsAgo: hoursAgo * 3600,
		open: false,
	});

	it("crawls at once before the first crawl", () => {
		assert.strictEqual(hours(crawlDelay(DAY, undefined, undefined)), 0);
	});

	it("resumes at once a crawl a restart cut short", () => {
		const open = { secondsAgo: 3600, open: true };

		assert.strictEqual(hours(crawlDelay(DAY, open, undefined)), 0);
	});

	it("waits after a restart until a day has passed since the last start", () => {
		assert.strictEqual(hours(crawlDelay(DAY, finished(18), undefined)), 6);
	});

	it("crawls at once when the last crawl started over a day ago", () => {
		assert.strictEqual(hours(crawlDelay(DAY, finished(30), undefined)), 0);
	});

	it("waits a day after its own try that stored no run", () => {
		assert.strictEqual(
			hours(crawlDelay(DAY, finished(30), Duration.hours(1))),
			23,
		);
	});

	it("does not resume at once a crawl it left open itself", () => {
		const open = { secondsAgo: 2 * 3600, open: true };

		assert.strictEqual(hours(crawlDelay(DAY, open, Duration.hours(2))), 22);
	});
});

describe("crawlSmart", () => {
	const smartWith = (forbidden: string) =>
		Layer.succeed(SmartClient, {
			get: (path) =>
				path === forbidden
					? Effect.fail(new SmartRequestFailed({ path, status: 403 }))
					: Effect.succeed({ items: [], total: 0 }),
		});

	it.effect(
		"stores each list as a page and fails the run on one failed list",
		() => {
			const store = makeMemoryStore();

			return Effect.gen(function* () {
				const error = yield* Effect.flip(crawlSmart());

				assert.instanceOf(error, SmartCrawlFailed);

				assert.deepStrictEqual(
					store.pages.map(
						(page) => `${page.status} ${page.error ?? ""} ${page.path}`,
					),
					[
						"done  /api/department",
						"failed HTTP 403 /api/teacher",
						"done  /api/discipline",
						"done  /api/teacher/disciplines",
					],
				);

				assert.match(
					store.finished[0]?.sourcePart ?? "",
					/^smart-ukma:\d{4}-\d{2}-\d{2}$/u,
				);
				assert.strictEqual(store.finished[0]?.status, "failed");
			}).pipe(Effect.provide([store.layer, smartWith("/api/teacher")]));
		},
	);

	it.effect("leaves an open САЗ run to the САЗ crawl", () => {
		const store = makeMemoryStore();

		return Effect.gen(function* () {
			yield* store.startRun("saz-courses:2031-32", []);
			yield* Effect.sync(() =>
				store.queue(
					1n,
					{ kind: "catalog", path: catalogPath(2031, 1) },
					"claimed",
				),
			);
			yield* store.startRun("smart-ukma:2031-09-01", SMART_PAGES);

			yield* crawlSmart();

			assert.deepStrictEqual(store.finished, [
				{ sourcePart: "smart-ukma:2031-09-01", status: "succeeded" },
			]);
			assert.strictEqual(store.pages[0]?.status, "claimed");
		}).pipe(Effect.provide([store.layer, smartWith("none")]));
	});

	it.effect("does not start while another smart crawl holds the lock", () => {
		const store = makeMemoryStore(undefined, false);

		return Effect.gen(function* () {
			const error = yield* Effect.flip(crawlSmart());

			assert.instanceOf(error, CrawlAlreadyRunning);
			assert.deepStrictEqual(store.pages, []);
		}).pipe(Effect.provide([store.layer, smartWith("none")]));
	});
});

/** Empties the crawl tables and the rows parsed from them, so each test
 *  starts without runs. */
const reset = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;

	yield* sql`TRUNCATE runs, run_pages, page_snapshots RESTART IDENTITY CASCADE`;
});

describe("crawlAllYears on Postgres", () => {
	layer(
		CrawlStore.layer.pipe(Layer.provideMerge(TestDatabase(testDatabaseUrl))),
		{ timeout: 30_000, excludeTestServices: true },
	)((it) => {
		it.effect(
			"gives a page that failed with a passing error one more pass",
			() => {
				let limited = false;

				const saz = makeFakeSaz({
					"/course/100004": Effect.suspend(() => {
						if (limited) return Effect.succeed("<html>course 100004</html>");

						limited = true;

						return Effect.fail(
							new SazRequestFailed({ path: "/course/100004", status: 429 }),
						);
					}),
				});

				return Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;

					yield* reset;
					yield* crawlAllYears();

					const pages = yield* sql<{
						readonly path: string;
						readonly status: string;
						readonly attempts: number;
					}>`
						SELECT path, status, attempts FROM run_pages
						WHERE path IN ('/course/100002', '/course/100003', '/course/100004')
						ORDER BY path
					`;

					assert.deepStrictEqual(
						pages.map(
							({ path, status, attempts }) => `${status} ${attempts} ${path}`,
						),
						[
							"failed 1 /course/100002",
							"done 2 /course/100003",
							"done 2 /course/100004",
						],
					);
				}).pipe(Effect.provide(saz.layer));
			},
		);

		it.effect("starts every year after a crash while starting them", () => {
			const saz = makeFakeSaz();

			return Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;

				const runs = sql<{ readonly sourcePart: string }>`
						SELECT source_part AS "sourcePart" FROM runs ORDER BY id
					`.pipe(
					Effect.map((rows) => rows.map(({ sourcePart }) => sourcePart)),
				);

				yield* reset;

				// The second year's insert fails, as a lost database would. The
				// trigger is dropped before the retry, even when the crash hangs.
				const failSecondYear = Effect.acquireRelease(
					sql`
							CREATE FUNCTION fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$
							BEGIN RAISE EXCEPTION 'insert failed'; END $$
						`.pipe(
						Effect.andThen(sql`
								CREATE TRIGGER fail_insert BEFORE INSERT ON runs FOR EACH ROW
								WHEN (NEW.source_part = 'saz-courses:2032-33')
								EXECUTE FUNCTION fail_insert()
							`),
					),
					() => sql`DROP FUNCTION fail_insert CASCADE`.pipe(Effect.orDie),
				);

				const crashed = yield* failSecondYear.pipe(
					Effect.andThen(Effect.exit(crawlAllYears())),
					Effect.scoped,
				);

				const afterCrash = yield* runs;

				yield* crawlAllYears();

				assert.isTrue(Exit.hasDies(crashed));
				assert.deepStrictEqual(afterCrash, []);
				assert.deepStrictEqual(yield* runs, [
					"saz-courses:2031-32",
					"saz-courses:2032-33",
				]);
			}).pipe(Effect.provide(saz.layer));
		});
	});
});
