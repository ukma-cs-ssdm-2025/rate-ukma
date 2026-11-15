import { assert, describe, it } from "@effect/vitest";
import { Exit, Schema } from "effect";
import { PageQuery, toPage } from "./lists.ts";

const rows = (...changeNos: ReadonlyArray<number>) =>
	changeNos.map((changeNo) => ({ changeNo }));

const updatedAt = new Date("2031-01-02T03:04:05Z");

describe("toPage", () => {
	it("keeps `limit` rows and tells that more follow from the extra one", () => {
		assert.deepStrictEqual(
			toPage(rows(11, 12, 13), { after: 10, limit: 2 }, updatedAt),
			{
				items: rows(11, 12),
				cursor: 12,
				hasMore: true,
				dataUpdatedAt: updatedAt,
			},
		);
	});

	it("ends the list on a short page", () => {
		assert.deepStrictEqual(
			toPage(rows(11, 12), { after: 10, limit: 2 }, null),
			{ items: rows(11, 12), cursor: 12, hasMore: false, dataUpdatedAt: null },
		);
	});

	it("keeps the reader's number on an empty page", () => {
		assert.deepStrictEqual(toPage([], { after: 40, limit: 500 }, updatedAt), {
			items: [],
			cursor: 40,
			hasMore: false,
			dataUpdatedAt: updatedAt,
		});
	});
});

describe("PageQuery", () => {
	const decode = Schema.decodeUnknownExit(Schema.Struct(PageQuery));

	it("defaults to every row in pages of 500", () => {
		assert.deepStrictEqual(decode({}), Exit.succeed({ after: 0, limit: 500 }));
		assert.deepStrictEqual(
			decode({ after: "25952", limit: "1000" }),
			Exit.succeed({ after: 25952, limit: 1000 }),
		);
	});

	it("refuses a page over 1000 rows, an empty page and a non-integer", () => {
		for (const query of [
			{ limit: "1001" },
			{ limit: "0" },
			{ after: "-1" },
			{ after: "1.5" },
			{ after: "" },
		]) {
			assert.isTrue(Exit.isFailure(decode(query)), JSON.stringify(query));
		}
	});
});
