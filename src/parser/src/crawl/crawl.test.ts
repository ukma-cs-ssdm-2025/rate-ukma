import { assert, describe, it } from "@effect/vitest";
import { Effect, Exit, Layer } from "effect";
import { catalogPath } from "../saz/catalog.ts";
import {
	type SazError,
	SazClient,
	SazRateLimited,
	SazRequestFailed,
	SazSignInFailed,
} from "../saz/SazClient.ts";
import { crawlYear } from "./crawl.ts";
import {
	type ClaimedPage,
	CrawlStore,
	type PageCounts,
	type PageKind,
	type RunReport,
} from "./CrawlStore.ts";

const card = (code: string) =>
	`<a class="btn btn-block btn-default" href="/course/${code}">Детальніше</a>`;

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

/** Course 100002 is gone. */
const SAZ_PAGES = new Map([
	["/course/100001", "<html>course 100001</html>"],
	["/course/100001/students", "[]"],
	["/course/100003", "<html>course 100003</html>"],
	["/course/100003/students", "[]"],
	["/course/100004", "<html>course 100004</html>"],
	["/course/100004/students", "[]"],
]);

const sazPage = (path: string): Effect.Effect<string, SazError> => {
	const body = path.startsWith("/course/catalog?")
		? catalogPage(path)
		: SAZ_PAGES.get(path);

	return body === undefined
		? Effect.fail(new SazRequestFailed({ path, status: 404 }))
		: Effect.succeed(body);
};

const FakeSaz = Layer.succeed(SazClient, { get: sazPage });

/** The fake САЗ with one page answered differently. */
const sazWith = (path: string, answer: Effect.Effect<string, SazError>) =>
	Layer.succeed(SazClient, {
		get: (requested) => (requested === path ? answer : sazPage(requested)),
	});

/** The queue in memory, one run at a time; completing `crashOn` dies, as a
 *  lost database would. */
const makeMemoryStore = (crashOn?: string) => {
	const pages: Array<ClaimedPage & { status: string }> = [];
	const finished: Array<{ status: string; report: RunReport }> = [];

	const queue = (page: { kind: PageKind; path: string }) => {
		if (!pages.some((queued) => queued.path === page.path)) {
			pages.push({ ...page, id: BigInt(pages.length + 1), status: "pending" });
		}
	};

	const mark = (page: ClaimedPage, status: string) =>
		Effect.sync(() => {
			const row = pages.find((queued) => queued.id === page.id);

			if (row) row.status = status;
		});

	const layer = Layer.succeed(CrawlStore, {
		startRun: (_, first) => Effect.sync(() => (queue(first), 1n)),
		claim: () =>
			Effect.sync(() => {
				const next = pages.find((page) => page.status === "pending");

				if (next) next.status = "claimed";

				return next;
			}),
		complete: (_, page, __, next) =>
			(page.path === crashOn
				? Effect.die(new Error("connection lost"))
				: mark(page, "done")
			).pipe(Effect.andThen(Effect.sync(() => next.forEach(queue)))),
		fail: (page) => mark(page, "failed"),
		pageCounts: () =>
			Effect.sync(() =>
				(["catalog", "course", "students"] as const).map(
					(kind): PageCounts => ({
						kind,
						done: pages.filter((p) => p.kind === kind && p.status === "done")
							.length,
						failed: pages.filter(
							(p) => p.kind === kind && p.status === "failed",
						).length,
						stored: 0,
					}),
				),
			),
		finishRun: (_, status, report) =>
			Effect.sync(() => void finished.push({ status, report })),
	});

	return { pages, finished, layer };
};

describe("crawlYear", () => {
	it.effect("visits every catalog page and each listed course", () => {
		const store = makeMemoryStore();

		return Effect.gen(function* () {
			yield* crawlYear(2031);

			assert.deepStrictEqual(
				store.pages.map((page) => `${page.status} ${page.path}`),
				[
					`done ${catalogPath(2031, 1)}`,
					`done ${catalogPath(2031, 2)}`,
					"done /course/100001",
					"done /course/100001/students",
					"failed /course/100002",
					"failed /course/100002/students",
					"done /course/100004",
					"done /course/100004/students",
					"done /course/100003",
					"done /course/100003/students",
				],
			);
			assert.strictEqual(store.finished[0]?.status, "succeeded");
		}).pipe(Effect.provide([store.layer, FakeSaz]));
	});

	it.effect("finds the courses the catalog's default filters hide", () => {
		const store = makeMemoryStore();

		return Effect.gen(function* () {
			yield* crawlYear(2031);

			assert.includeMembers(
				store.pages.flatMap((page) =>
					page.status === "done" ? [page.path] : [],
				),
				["/course/100004", "/course/100004/students"],
			);
		}).pipe(Effect.provide([store.layer, FakeSaz]));
	});

	it.effect("fails the run when a catalog page fails", () => {
		const store = makeMemoryStore();

		return Effect.gen(function* () {
			yield* crawlYear(2032);

			assert.strictEqual(store.finished[0]?.status, "failed");
		}).pipe(Effect.provide([store.layer, FakeSaz]));
	});

	it.effect("fails the run when the first catalog page lost its pager", () => {
		const store = makeMemoryStore();
		const first = catalogPath(2031, 1);

		return Effect.gen(function* () {
			yield* crawlYear(2031);

			assert.deepStrictEqual(
				store.pages.map((page) => `${page.status} ${page.path}`),
				[`failed ${first}`],
			);
			assert.strictEqual(store.finished[0]?.status, "failed");
		}).pipe(
			Effect.provide([
				store.layer,
				sazWith(
					first,
					sazPage(first).pipe(Effect.map((body) => body.replace(PAGER, ""))),
				),
			]),
		);
	});

	it.effect("fails the run and stops when the sign-in fails", () => {
		const store = makeMemoryStore();

		return Effect.gen(function* () {
			const exit = yield* Effect.exit(crawlYear(2031));

			assert.isTrue(Exit.isFailure(exit));
			assert.strictEqual(store.finished[0]?.status, "failed");
			assert.strictEqual(
				store.pages.find((page) => page.path === "/course/100001/students")
					?.status,
				"pending",
			);
		}).pipe(
			Effect.provide([
				store.layer,
				sazWith(
					"/course/100001",
					Effect.fail(new SazSignInFailed({ reason: "Microsoft error 50053" })),
				),
			]),
		);
	});

	it.effect("fails the run and stops when САЗ asks for a long wait", () => {
		const store = makeMemoryStore();
		const fetched: Array<string> = [];

		const saz = Layer.succeed(SazClient, {
			get: (path) =>
				Effect.suspend(() => {
					fetched.push(path);

					return path === "/course/100001"
						? Effect.fail(new SazRateLimited({ path, retryAfterSeconds: 600 }))
						: sazPage(path);
				}),
		});

		return Effect.gen(function* () {
			const exit = yield* Effect.exit(crawlYear(2031));

			assert.isTrue(Exit.isFailure(exit));
			assert.strictEqual(store.finished[0]?.status, "failed");
			assert.strictEqual(fetched.at(-1), "/course/100001");
		}).pipe(Effect.provide([store.layer, saz]));
	});

	it.effect("leaves the run running when the database is lost", () => {
		const store = makeMemoryStore("/course/100001");

		return Effect.gen(function* () {
			const exit = yield* Effect.exit(crawlYear(2031));

			assert.isTrue(Exit.isFailure(exit));
			assert.deepStrictEqual(store.finished, []);
		}).pipe(Effect.provide([store.layer, FakeSaz]));
	});
});
