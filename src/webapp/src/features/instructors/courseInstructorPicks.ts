import type { CourseInstructorMentions } from "@/lib/api/generated";

const MAX_PICKS = 2;
// One mention on the student's own offering is a fresh, direct signal; across
// the whole course a single old tag could be a typo, so it takes two.
const MIN_OFFERING_MENTIONS = 1;
const MIN_COURSE_MENTIONS = 2;

/** Teachers worth offering one tap away: named by others on this offering or
 * repeatedly on the course, not already chosen. Input arrives ranked. */
export function pickCourseInstructors(
	items: ReadonlyArray<CourseInstructorMentions>,
	selectedIds: ReadonlyArray<string>,
): CourseInstructorMentions[] {
	return items
		.filter(
			(item) =>
				item.offering_ratings_count >= MIN_OFFERING_MENTIONS ||
				item.ratings_count >= MIN_COURSE_MENTIONS,
		)
		.filter(
			(item) =>
				item.instructor.id !== undefined &&
				!selectedIds.includes(item.instructor.id),
		)
		.slice(0, MAX_PICKS);
}
