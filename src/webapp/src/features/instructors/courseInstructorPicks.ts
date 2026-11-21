import type { CourseInstructorMentions } from "@/lib/api/generated";

const MAX_PICKS = 2;
const MAX_WITH_PLANNED = 3;
const MIN_OFFERING_MENTIONS = 1;
const MIN_COURSE_MENTIONS = 2;

export function pickCourseInstructors(
	items: ReadonlyArray<CourseInstructorMentions>,
	selectedIds: ReadonlyArray<string>,
): CourseInstructorMentions[] {
	const open = items.filter(
		(item) =>
			item.instructor.id !== undefined &&
			!selectedIds.includes(item.instructor.id),
	);
	const named = open
		.filter(
			(item) =>
				item.offering_ratings_count >= MIN_OFFERING_MENTIONS ||
				item.ratings_count >= MIN_COURSE_MENTIONS,
		)
		.slice(0, MAX_PICKS);
	const planned = open.filter((item) => item.planned && !named.includes(item));

	return [...named, ...planned].slice(0, MAX_WITH_PLANNED);
}
