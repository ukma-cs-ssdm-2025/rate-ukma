import type { CourseInstructorMentions } from "@/lib/api/generated";
import { formatInstructorName } from "./formatInstructorName";

export interface CourseTeacher {
	readonly id: string;
	readonly name: string;
	readonly note: string;
}

const MIN_STUDENTS = 2;

const UK_PLURAL = new Intl.PluralRules("uk");
const STUDENT_FORMS: Record<Intl.LDMLPluralRule, string> = {
	zero: "студентів",
	one: "студент",
	two: "студенти",
	few: "студенти",
	many: "студентів",
	other: "студента",
};

export function chosenByNote(count: number): string {
	const form = UK_PLURAL.select(count);
	const verb = form === "one" ? "обрав" : "обрали";
	return `${verb} ${count} ${STUDENT_FORMS[form]}`;
}

export function namedCourseTeachers(
	items: ReadonlyArray<CourseInstructorMentions>,
): CourseTeacher[] {
	return items
		.filter((item) => item.students_count >= MIN_STUDENTS)
		.sort((a, b) => b.students_count - a.students_count)
		.flatMap(({ instructor, students_count }) =>
			instructor.id === undefined
				? []
				: [
						{
							id: instructor.id,
							name: formatInstructorName(instructor),
							note: chosenByNote(students_count),
						},
					],
		);
}
