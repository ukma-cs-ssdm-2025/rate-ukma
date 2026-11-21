import type { CourseInstructorMentions } from "@/lib/api/generated";

const MAX_PICKS = 2;
const MIN_OFFERING_MENTIONS = 1;
const MIN_COURSE_MENTIONS = 2;

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
