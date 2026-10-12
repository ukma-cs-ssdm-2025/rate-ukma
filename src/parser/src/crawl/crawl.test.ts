import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { catalogPath } from "../saz/catalog.ts";
import { SazClient, SazRequestFailed } from "../saz/SazClient.ts";
import { crawlYear } from "./crawl.ts";
import {
	type ClaimedPage,
	CrawlStore,
	type KindTally,
	type PageKind,
	type RunReport,
} from "./CrawlStore.ts";

const card = (code: string) =>
	`<a class="btn btn-block btn-default" href="/course/${code}">Детальніше</a>`;

const PAGER = `<li class="last"><a href="${catalogPath(2031, 2).replace("&", "&amp;")}" data-page="1">&raquo;</a></li>`;

/** Two catalog pages of 2031-32; course 100002 is gone. */
const SAZ_PAGES = new Map([
	[catalogPath(2031, 1), card("100001") + card("100002") + PAGER],
	[catalogPath(2031, 2), card("100003")],
	["/course/100001", "<html>course 100001</html>"],
	["/course/100001/students", "[]"],
	["/course/100003", "<html>course 100003</html>"],
	["/course/100003/students", "[]"],
]);

const FakeSaz = Layer.succeed(SazClient, {
	get: (path) => {
		const body = SAZ_PAGES.get(path);

		return body === undefined
			? Effect.fail(new SazRequestFailed({ path, status: 404 }))
			: Effect.succeed(body);
	},
});

/** The queue in memory, one run at a time. */
const makeMemoryStore = () => {
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
			mark(page, "done").pipe(
				Effect.andThen(Effect.sync(() => next.forEach(queue))),
			),
		fail: (page) => mark(page, "failed"),
		tally: () =>
			Effect.sync(() =>
				(["catalog", "course", "students"] as const).map((kind): KindTally => ({
					kind,
					done: pages.filter((p) => p.kind === kind && p.status === "done")
						.length,
					failed: pages.filter((p) => p.kind === kind && p.status === "failed")
						.length,
					stored: 0,
				})),
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
					"done /course/100003",
					"done /course/100003/students",
				],
			);
			assert.strictEqual(store.finished[0]?.status, "succeeded");
		}).pipe(Effect.provide([store.layer, FakeSaz]));
	});

	it.effect("fails the run when a catalog page fails", () => {
		const store = makeMemoryStore();

		return Effect.gen(function* () {
			yield* crawlYear(2032);

			assert.strictEqual(store.finished[0]?.status, "failed");
		}).pipe(Effect.provide([store.layer, FakeSaz]));
	});
});
