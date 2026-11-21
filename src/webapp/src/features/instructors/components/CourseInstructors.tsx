import { useCoursesInstructorsRetrieve } from "@/lib/api/generated";
import { useFeatureFlag } from "@/lib/feature-flags";
import { courseTeachers } from "../courseTeachers";
import { CourseTeachersRow } from "./CourseTeachersRow";

export function CourseInstructors({
	courseId,
}: Readonly<{ courseId: string }>) {
	const enabled = useFeatureFlag("fe_course_instructors");
	const { data } = useCoursesInstructorsRetrieve(courseId, undefined, {
		query: { enabled },
	});

	if (!enabled) {
		return null;
	}

	return <CourseTeachersRow teachers={courseTeachers(data?.items ?? [])} />;
}
