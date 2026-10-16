import { assert, describe, it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { catalogPath } from "../saz/catalog.ts";
import {
	type SazError,
	SazClient,
	SazRequestFailed,
	SazSignInFailed,
} from "../saz/SazClient.ts";
import {
	CrawlAlreadyRunning,
	crawlAllYears,
	NoAcademicYears,
} from "./crawl.ts";
import {
	CrawlStore,
	type KindTally,
	type OpenRun,
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

	const startRun = (sourcePart: string, first: QueuedPage) =>
		Effect.sync(() => {
			const run = {
				id: BigInt(runs.length + 1),
				sourcePart,
				status: "running",
			};

			runs.push(run);
			queue(run.id, first);

			return { id: run.id, sourcePart };
		});

	const tally = (runId: bigint, kind: KindTally["kind"]): KindTally => {
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
		pages: (["catalog", "course", "students"] as const).map((kind) =>
			tally(runId, kind),
		),
		failures: [],
	});

	const layer = Layer.succeed(CrawlStore, {
		lockCrawl: Effect.succeed(locked),
		startRun,
		openRuns: Effect.sync(() => {
			for (const page of pages) {
				if (page.status === "claimed") page.status = "pending";
			}

			return runs.flatMap(({ id, sourcePart, status }) =>
				status === "running" ? [{ id, sourcePart }] : [],
			);
		}),
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
			const run = yield* store.startRun("saz-courses:2031-32", {
				kind: "catalog",
				path: catalogPath(2031, 1),
			});

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

	it.effect("gives a page that САЗ rate-limited one more pass", () => {
		const store = makeMemoryStore();
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
			yield* crawlAllYears();

			assert.strictEqual(
				store.pages.find((page) => page.path === "/course/100004")?.status,
				"done",
			);
		}).pipe(Effect.provide([store.layer, saz.layer]));
	});
});
