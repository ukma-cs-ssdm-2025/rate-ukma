import { useMemo } from "react";

import { useStudentsMeCoursesRetrieve } from "@/lib/api/generated";

export function useAttendedCourses() {
	const { data, isLoading, error } = useStudentsMeCoursesRetrieve();

	const attendedCourseIds = useMemo(() => {
		if (!data) return new Set<string>();
		return new Set(
			data.map((course) => course.id).filter((id): id is string => Boolean(id)),
		);
	}, [data]);

	return {
		attendedCourses: data,
		attendedCourseIds,
		isLoading,
		error,
	};
}
