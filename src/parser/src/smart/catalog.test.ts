import { assert, describe, it } from "@effect/vitest";
import { Result } from "effect";
import { smartRowsOf, termOf } from "./catalog.ts";
import { smartLists } from "./catalog.fixture.ts";

describe("termOf", () => {
	it("counts three terms a study year", () => {
		assert.deepStrictEqual(
			[1, 2, 3, 4, 6, 12].map((semester) => termOf(semester, 2025)),
			[
				{ academicYear: 2025, season: "FALL" },
				{ academicYear: 2025, season: "SPRING" },
				{ academicYear: 2025, season: "SUMMER" },
				{ academicYear: 2026, season: "FALL" },
				{ academicYear: 2026, season: "SUMMER" },
				{ academicYear: 2028, season: "SUMMER" },
			],
		);
		assert.deepStrictEqual(termOf(5, null), {
			academicYear: null,
			season: "SPRING",
		});
	});
});

describe("smartRowsOf", () => {
	it("gives teachers and disciplines with their teacher links", () => {
		const rows = Result.getOrThrow(smartRowsOf(smartLists()));

		assert.deepStrictEqual(
			rows.instructors.map(({ rowHash, ...row }) => {
				assert.match(rowHash, /^[0-9a-f]{64}$/);

				return row;
			}),
			[
				{
					smartId: 7001,
					lastName: "Вигаданенко",
					firstName: "Марта",
					middleName: "Олегівна",
					email: "m.vyhadanenko@example.edu",
					smartDepartmentId: 901,
					departmentName: "Кафедра вигаданих систем",
				},
				{
					smartId: 7002,
					lastName: "Зразковий",
					firstName: "Тарас",
					middleName: null,
					email: null,
					smartDepartmentId: null,
					departmentName: null,
				},
			],
		);
		assert.deepStrictEqual(
			rows.disciplines.map(
				({
					smartId,
					departmentName,
					academicYear,
					season,
					level,
					teachers,
				}) => [smartId, departmentName, academicYear, season, level, teachers],
			),
			[
				[
					5001,
					"Кафедра вигаданих систем",
					2025,
					"FALL",
					"bachelor",
					[
						{ smartId: 7001, role: "LECTURER" },
						{ smartId: 7002, role: "PRACTICE_TEACHER" },
					],
				],
				[
					5002,
					"Кафедра вигаданих систем",
					2025,
					"SUMMER",
					"master",
					[{ smartId: 7999, role: "LECTURER_AND_PRACTICE_TEACHER" }],
				],
				[5003, "Кафедра вигаданих систем", 2026, "SUMMER", null, []],
			],
		);
	});

	it("hashes only content, so the same lists give the same rows", () => {
		const first = Result.getOrThrow(smartRowsOf(smartLists()));
		const second = Result.getOrThrow(smartRowsOf(smartLists()));

		assert.deepStrictEqual(first, second);
	});

	it("names the list that did not decode, never a value", () => {
		const result = smartRowsOf(
			smartLists({ teachers: JSON.stringify({ items: [{ id: "x" }] }) }),
		);

		assert.isTrue(Result.isFailure(result));
		assert.strictEqual(
			Result.isFailure(result) ? result.failure.reason : "",
			"invalid teachers",
		);
	});
});
