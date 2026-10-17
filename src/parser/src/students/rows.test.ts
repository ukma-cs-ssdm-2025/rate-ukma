import { assert, describe, it } from "@effect/vitest";
import { Result } from "effect";
import {
	type EntryValue,
	studentEntry,
	studentsPage,
} from "../saz/studentsPage.fixture.ts";
import { parseStudentsPage, type StudentEntry } from "../saz/studentsPage.ts";
import { type StudentList, studentRowsOf } from "./rows.ts";
import { batchesOf } from "./students.ts";

const list = (
	snapshotId: bigint,
	sazCode: string,
	...entries: ReadonlyArray<Readonly<Record<string, EntryValue>>>
): StudentList => {
	const result = parseStudentsPage(studentsPage(...entries));

	return {
		snapshotId,
		sazCode,
		entries: Result.isSuccess(result) ? result.success : [],
	};
};

const OTHER = {
	cdoc: 600125,
	name: "Приклад Марія Іванівна",
	email: "m.pryklad@example.edu",
};

describe("studentRowsOf", () => {
	it("takes a person's fields from the latest list, whatever the order", () => {
		const rows = studentRowsOf(
			[
				list(9n, "900002", studentEntry({ specName: "Вигадана економіка" })),
				list(5n, "900001", studentEntry({ name: "Зразок Олена" })),
			],
			new Map(),
		);

		assert.deepStrictEqual(rows.students, [
			{
				email: "o.zrazok@example.edu",
				cdoc: null,
				fullName: "Зразок Олена Петрівна",
				snapshotId: "9",
			},
		]);
		assert.deepStrictEqual(rows.programmes, [
			{
				cdoc: "600123",
				email: "o.zrazok@example.edu",
				specName: "Вигадана економіка",
				snapshotId: "9",
				sazCodes: ["900001", "900002"],
			},
		]);
		assert.strictEqual(rows.enrollments.length, 2);
	});

	it("keeps a name without `*` over a later one with it", () => {
		const rows = studentRowsOf(
			[
				list(1n, "900001", studentEntry()),
				list(2n, "900002", studentEntry({ name: "Зр*зок Олена Петрівна" })),
			],
			new Map(),
		);

		assert.strictEqual(rows.students[0]?.fullName, "Зразок Олена Петрівна");
	});

	it("keys a person by email, else by `cdoc` (D2, D3)", () => {
		const rows = studentRowsOf(
			[
				list(
					1n,
					"900001",
					studentEntry(),
					studentEntry({ cdoc: 600124, specName: "Вигадана економіка" }),
					studentEntry({ ...OTHER, email: "" }),
				),
			],
			new Map(),
		);

		assert.deepStrictEqual(
			rows.students.map(({ email, cdoc }) => ({ email, cdoc })),
			[
				{ email: "o.zrazok@example.edu", cdoc: null },
				{ email: null, cdoc: "600125" },
			],
		);
		assert.deepStrictEqual(
			rows.programmes.map(({ cdoc }) => cdoc),
			["600123", "600124", "600125"],
		);
	});

	it("leaves a record stored from a newer list to that list (D1)", () => {
		const rows = studentRowsOf(
			[
				list(
					5n,
					"900001",
					studentEntry({ email: "old@example.edu" }),
					studentEntry(OTHER),
				),
			],
			new Map([["600123", 7n]]),
		);

		assert.deepStrictEqual(
			rows.students.map(({ email }) => email),
			["m.pryklad@example.edu"],
		);
		assert.deepStrictEqual(
			rows.programmes.map(({ cdoc }) => cdoc),
			["600125"],
		);
		assert.strictEqual(rows.enrollments.length, 2);
	});
});

describe("batchesOf", () => {
	const sized = (snapshotId: bigint, entries: number): StudentList => ({
		snapshotId,
		sazCode: String(snapshotId),
		entries: Array.from<StudentEntry>({ length: entries }),
	});

	it("starts a batch once the last one holds `size` entries", () => {
		const batches = batchesOf(
			[sized(1n, 3), sized(2n, 0), sized(3n, 2), sized(4n, 1)],
			3,
		);

		assert.deepStrictEqual(
			batches.map((batch) => batch.map(({ snapshotId }) => snapshotId)),
			[[1n], [2n, 3n, 4n]],
		);
	});
});
