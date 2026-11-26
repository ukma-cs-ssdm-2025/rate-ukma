import { describe, expect, it } from "vitest";

import type { UkmaDataStudentCase } from "@/lib/api/generated";
import { studentComparison } from "./studentCase";

const base: UkmaDataStudentCase = {
	id: "rc-1",
	kind: "student_match",
	status: "open",
	opened_at: "2030-09-01T08:00:00Z",
	record: {
		student_id: "s-1",
		record_id: "pr-1",
		first_name: "Тест",
		last_name: "Обʼєктенко",
		programme: "Тестова програма",
		study_year: 1,
		status: "active",
	},
	joined_student_id: "s-2",
	candidates: [
		{
			student_id: "s-2",
			record_id: null,
			first_name: "тест",
			last_name: "Об'єктенко",
			programme: null,
			study_year: null,
			status: null,
		},
	],
};

describe("studentComparison", () => {
	it("ignores case, apostrophe variants and fields САЗ does not know", () => {
		const { rows, summary } = studentComparison(base);

		expect(rows.flatMap((row) => row.differs)).not.toContain(true);
		expect(rows.find((row) => row.field === "study_year")?.values).toEqual([
			"1",
			"—",
		]);
		expect(summary).toBe(
			"Усе, що знає САЗ, збігається зі студентом, до якого запис приєднано.",
		);
	});

	it("names the fields that differ from the record", () => {
		const { rows, summary } = studentComparison({
			...base,
			candidates: [
				{
					...base.record,
					student_id: "s-2",
					status: "inactive",
					study_year: 4,
				},
			],
		});

		expect(rows.find((row) => row.field === "status")?.values).toEqual([
			"Навчається",
			"Не навчається",
		]);
		expect(summary).toBe("Відрізняється від запису: рік навчання, статус.");
	});
});
