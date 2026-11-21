import type { CourseInstructorMentions } from "@/lib/api/generated";
import { formatInstructorName } from "./formatInstructorName";

/** A teacher on the course page's row and why they are listed. Students'
 *  mentions fill it today; a planned teacher would come with its own note. */
export interface CourseTeacher {
	readonly id: string;
	readonly name: string;
	readonly note: string;
}

// One mention could be a typo; two students agreeing is a signal.
const MIN_MENTIONS = 2;

const UK_PLURAL = new Intl.PluralRules("uk");
const STUDENT_FORMS: Record<Intl.LDMLPluralRule, string> = {
	zero: "студентів",
	one: "студент",
	two: "студенти",
	few: "студенти",
	many: "студентів",
	other: "студента",
};

/** "обрали 3 студенти", "обрав 21 студент". */
export function chosenByNote(count: number): string {
	const form = UK_PLURAL.select(count);
	const verb = form === "one" ? "обрав" : "обрали";
	return `${verb} ${count} ${STUDENT_FORMS[form]}`;
}

/** Teachers students named at least twice on the course, most named first. */
export function namedCourseTeachers(
	items: ReadonlyArray<CourseInstructorMentions>,
): CourseTeacher[] {
	return items
		.filter((item) => item.ratings_count >= MIN_MENTIONS)
		.sort((a, b) => b.ratings_count - a.ratings_count)
		.flatMap(({ instructor, ratings_count }) =>
			instructor.id === undefined
				? []
				: [
						{
							id: instructor.id,
							name: formatInstructorName(instructor),
							note: chosenByNote(ratings_count),
						},
					],
		);
}
