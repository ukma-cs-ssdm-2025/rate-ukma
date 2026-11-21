import type { CourseInstructorMentions } from "@/lib/api/generated";
import { formatInstructorName } from "./formatInstructorName";

export interface CourseTeacher {
	readonly id: string;
	readonly name: string;
	readonly note: string;
}

const MIN_STUDENTS = 2;

const PLANNED_NOTE = "за планом";

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

function teacherOf(
	{ instructor }: CourseInstructorMentions,
	note: string,
): CourseTeacher[] {
	return instructor.id === undefined
		? []
		: [{ id: instructor.id, name: formatInstructorName(instructor), note }];
}

export function courseTeachers(
	items: ReadonlyArray<CourseInstructorMentions>,
): CourseTeacher[] {
	const named = items
		.filter((item) => item.recent_students_count >= MIN_STUDENTS)
		.sort((a, b) => b.recent_students_count - a.recent_students_count)
		.flatMap((item) =>
			teacherOf(item, chosenByNote(item.recent_students_count)),
		);

	if (named.length > 0) {
		return named;
	}

	return items
		.filter((item) => item.planned)
		.flatMap((item) => teacherOf(item, PLANNED_NOTE));
}
