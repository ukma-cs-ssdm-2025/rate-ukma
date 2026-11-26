import { describe, expect, it } from "vitest";

import type { UkmaDataStudentCase } from "@/lib/api/generated";
import {
	caseRowHint,
	fullName,
	initials,
	offeringFacts,
	peopleTable,
} from "./casePeople";

const person = {
	student_id: "student-new",
	record_id: "record-new",
	first_name: "Олена",
	last_name: "Коваль",
	middle_name: "Петрівна",
	programme: "Компʼютерні науки",
	study_year: 1,
	status: "active",
} as const;

const found: UkmaDataStudentCase = {
	id: "case-1",
	kind: "student_match",
	status: "open",
	opened_at: "2026-09-01T10:00:00Z",
	record: person,
	joined_student_id: "student-old",
	candidates: [
		{
			...person,
			student_id: "student-old",
			middle_name: "Іванівна",
			programme: "Математика",
			study_year: 4,
			status: "inactive",
		},
		{ ...person, student_id: "student-twin" },
	],
};

describe("people of a student case", () => {
	it("keeps the patronymic in the full name and the initials", () => {
		expect(fullName(person)).toBe("Коваль Олена Петрівна");
		expect(initials(person)).toBe("Коваль О. П.");
		expect(initials({ ...person, middle_name: null })).toBe("Коваль О.");
	});

	it("marks only the values that differ from the new record", () => {
		// Arrange & Act
		const table = peopleTable(found);

		// Assert
		expect(table.columns.map((column) => column.label)).toEqual([
			"Новий запис із САЗ",
			"Приєднано зараз",
			"Схожий студент",
		]);
		expect(table.columns[1]?.values).toEqual([
			"Коваль Олена Іванівна",
			"Математика",
			"4-й",
			"не навчається",
		]);
		expect(table.columns[1]?.differs).toEqual([true, true, true, true]);
		expect(table.columns[2]?.differs).toEqual([false, false, false, false]);
	});

	it("names a list row by initials, programme and year", () => {
		expect(caseRowHint(found)).toBe("Коваль О. П., Компʼютерні науки, 1-й рік");
	});
});

describe("offeringFacts", () => {
	it("gives department, semester and ratings in words", () => {
		expect(
			offeringFacts({
				ukma_data_id: "off-1",
				course_id: "course-1",
				title: "Тестова дисципліна",
				department: "Кафедра прикладів",
				year: 2026,
				term: "FALL",
				ratings: 3,
			}),
		).toBe("Кафедра прикладів, Осінь 2026, 3 оцінки");
	});
});
