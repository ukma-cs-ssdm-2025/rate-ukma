import { useCoursesInstructorsRetrieve } from "@/lib/api/generated";
import { useFeatureFlag } from "@/lib/feature-flags";
import { namedCourseTeachers } from "../courseTeachers";
import { CourseTeachersRow } from "./CourseTeachersRow";

/** The teachers students named on this course, behind `fe_course_instructors`. */
export function CourseInstructors({
	courseId,
}: Readonly<{ courseId: string }>) {
	const enabled = useFeatureFlag("fe_course_instructors");
	const { data } = useCoursesInstructorsRetrieve(courseId, undefined, {
		query: { enabled },
	});

	if (!enabled) return null;

	return (
		<CourseTeachersRow teachers={namedCourseTeachers(data?.items ?? [])} />
	);
}
