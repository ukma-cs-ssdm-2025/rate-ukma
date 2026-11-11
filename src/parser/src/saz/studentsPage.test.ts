import { assert, describe, it } from "@effect/vitest";
import { Result } from "effect";
import { studentEntry, studentsPage } from "./studentsPage.fixture.ts";
import { parseStudentsPage } from "./studentsPage.ts";

const reasonOf = (content: string) => {
	const result = parseStudentsPage(content);

	return Result.isFailure(result) ? result.failure.reason : undefined;
};

describe("parseStudentsPage", () => {
	it("keeps the enrollment facts and normalises the person fields", () => {
		const result = parseStudentsPage(
			studentsPage(
				studentEntry({
					email: " O.Zrazok@Example.EDU ",
					name: "Зразок  Олена\tПетрівна ",
				}),
				studentEntry({
					cdoc: 600124,
					name: "Приклад Ігор Васильович",
					email: "",
					type: "zfree",
					status: -10,
					statusLabel: "не навчається",
					isStudentActive: false,
					isForced: true,
					group: null,
					createdAt: 0,
				}),
			),
		);

		assert.deepStrictEqual(
			result,
			Result.succeed([
				{
					cdoc: "600123",
					email: "o.zrazok@example.edu",
					fullName: "Зразок Олена Петрівна",
					specName: "Вигадана інженерія",
					kind: "compulsory",
					status: "enrolled",
					isStudentActive: true,
					isForced: false,
					groupNo: 2,
					grade: 3,
					sazCreatedAt: "2027-01-15T08:00:00.000Z",
					sazUpdatedAt: null,
				},
				{
					cdoc: "600124",
					email: null,
					fullName: "Приклад Ігор Васильович",
					specName: "Вигадана інженерія",
					kind: "elective",
					status: "unenrolled",
					isStudentActive: false,
					isForced: true,
					groupNo: null,
					grade: 3,
					sazCreatedAt: null,
					sazUpdatedAt: null,
				},
			]),
		);
	});

	it("reads `[]` as an empty list", () => {
		assert.deepStrictEqual(parseStudentsPage("[]"), Result.succeed([]));
	});

	it("names the key that failed, never its value", () => {
		const { email: _email, ...withoutEmail } = studentEntry();

		assert.strictEqual(reasonOf("<html>"), "invalid page");
		assert.strictEqual(reasonOf("{}"), "invalid page");
		assert.strictEqual(reasonOf(studentsPage(withoutEmail)), "invalid email");
		assert.strictEqual(
			reasonOf(studentsPage(studentEntry({ status: 5 }))),
			"invalid status",
		);
		assert.strictEqual(
			reasonOf(studentsPage(studentEntry({ name: " " }))),
			"invalid name",
		);
		assert.strictEqual(
			reasonOf(studentsPage(studentEntry({ phone: "000" }))),
			"invalid phone",
		);
	});

	it("fails a page that lists one programme record twice", () => {
		assert.strictEqual(
			reasonOf(studentsPage(studentEntry(), studentEntry())),
			"repeated cdoc",
		);
	});
});
