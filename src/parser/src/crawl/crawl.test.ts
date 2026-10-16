import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { catalogPath } from "../saz/catalog.ts";
import { SazClient, SazRequestFailed } from "../saz/SazClient.ts";
import { crawlSmart, SMART_PAGES, SmartCrawlFailed } from "../smart/crawl.ts";
import { SmartClient, SmartRequestFailed } from "../smart/SmartClient.ts";
import { crawlAllYears, NoAcademicYears } from "./crawl.ts";
import {
	CrawlStore,
	type KindTally,
	type OpenRun,
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

/** 2031-32 lists courses on two catalog pages, course 100002 is gone and
 *  course 100003 drops the connection once; the 2032-33 catalog does not load. */
const SAZ_PAGES = new Map([
	["/course/catalog", YEARS],
	[catalogPath(2031, 1), card("100001") + card("100002") + PAGER],
	[catalogPath(2031, 2), card("100003")],
	["/course/100001", "<html>course 100001</html>"],
	["/course/100001/students", "[]"],
	["/course/100003", "<html>course 100003</html>"],
	["/course/100003/students", "[]"],
]);

const makeFakeSaz = () => {
	const fetched: Array<string> = [];

	const layer = Layer.succeed(SazClient, {
		get: (path) => {
			fetched.push(path);

			const body = SAZ_PAGES.get(path);

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

/** The run queue in memory. */
const makeMemoryStore = () => {
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
		pages: PageKind.literals.map((kind) => tally(runId, kind)),
		failures: [],
	});

	const layer = Layer.succeed(CrawlStore, {
		startRun,
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
			mark(page.id, "done").pipe(
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
		requeue: (runId, error) =>
			Effect.sync(() => {
				const failed = pages.filter(
					(page) =>
						page.runId === runId &&
						page.status === "failed" &&
						page.error === error &&
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
});
