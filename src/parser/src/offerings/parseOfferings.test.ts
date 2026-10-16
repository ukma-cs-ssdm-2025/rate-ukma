import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { coursePage } from "../saz/coursePage.fixture.ts";
import { parseOfferings } from "./offerings.ts";
import {
	OfferingStore,
	type ParseFailure,
	type ParseReport,
	type ParseTrigger,
	type StoredPage,
} from "./OfferingStore.ts";

/** Snapshots and the offering rows in memory, keyed by САЗ code. */
const makeMemoryStore = (snapshots: Array<StoredPage>) => {
	const offerings = new Map<string, { title: string; snapshotId: string }>();
	const parses: Array<{ trigger: ParseTrigger; report?: ParseReport }> = [];
	const failures: Array<ParseFailure & { parseId: bigint }> = [];

	const layer = Layer.succeed(OfferingStore, {
		latestCoursePages: Effect.sync(() =>
			[...new Map(snapshots.map(({ id, path }) => [path, id])).values()].sort(
				(a, b) => Number(a - b),
			),
		),
		coursePages: (ids) =>
			Effect.sync(() => snapshots.filter(({ id }) => ids.includes(id))),
		latestCatalogPage: Effect.succeed(undefined),
		write: (rows) =>
			Effect.sync(() => {
				for (const { sazCode, title, snapshotId } of rows.offerings) {
					offerings.set(sazCode, { title, snapshotId });
				}

				return [
					{
						table: "offerings" as const,
						action: "change" as const,
						rows: rows.offerings.length,
					},
				];
			}),
		startParse: (trigger) =>
			Effect.sync(() => BigInt(parses.push({ trigger }))),
		recordFailures: (parseId, failed) =>
			Effect.sync(() => {
				failures.push(...failed.map((failure) => ({ ...failure, parseId })));
			}),
		finishParse: (parseId, report) =>
			Effect.sync(() => {
				parses[Number(parseId) - 1] = {
					...parses[Number(parseId) - 1],
					report,
				};
			}),
	});

	return { offerings, parses, failures, layer };
};

describe("parseOfferings", () => {
	it.effect(
		"keeps a failed page's last good rows and records the failure",
		() => {
			const good = coursePage({
				code: "900123",
				title: "Вступ до вигаданих систем",
			});

			const snapshots: Array<StoredPage> = [
				{ id: 1n, path: "/course/900123", content: good },
				{
					id: 2n,
					path: "/course/900124",
					content: coursePage({ code: "900124" }),
				},
			];

			const store = makeMemoryStore(snapshots);

			return Effect.gen(function* () {
				yield* parseOfferings("crawl");

				// A later crawl stores a copy of the page with its card cut off.
				snapshots.push({
					id: 3n,
					path: "/course/900123",
					content: good.slice(0, good.indexOf('<div id="w0">')),
				});

				const report = yield* parseOfferings("reparse");

				assert.deepStrictEqual(store.offerings.get("900123"), {
					title: "Вступ до вигаданих систем",
					snapshotId: "1",
				});
				assert.strictEqual(store.offerings.get("900124")?.snapshotId, "2");
				assert.deepStrictEqual(store.failures, [
					{
						parseId: 2n,
						snapshotId: 3n,
						path: "/course/900123",
						reason: "no course card",
					},
				]);
				assert.deepStrictEqual(report, {
					seconds: 0,
					parsed: 1,
					failed: [{ reason: "no course card", pages: 1 }],
					changes: [{ table: "offerings", action: "change", rows: 1 }],
				});
				assert.deepStrictEqual(store.parses, [
					{
						trigger: "crawl",
						report: {
							seconds: 0,
							parsed: 2,
							failed: [],
							changes: [{ table: "offerings", action: "change", rows: 2 }],
						},
					},
					{ trigger: "reparse", report },
				]);
			}).pipe(Effect.provide(store.layer));
		},
	);
});
