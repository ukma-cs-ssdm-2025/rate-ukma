import { useMemo } from "react";

import type { InlineCourseOffering, InlineRating } from "@/lib/api/generated";
import { useStudentsMeCoursesRetrieve } from "@/lib/api/generated";

export interface UserCourseRating {
	rating: InlineRating | null;
	ratingId: string | undefined;
	ratedOffering: InlineCourseOffering | null;
	attendedOfferings: readonly InlineCourseOffering[];
	hasAttendedCourse: boolean;
	selectedOffering: InlineCourseOffering | null;
	attendedCourseId: string | undefined;
	isLoading: boolean;
}

export function useUserCourseRating(courseId: string): UserCourseRating {
	const { data: studentCourses, isLoading } = useStudentsMeCoursesRetrieve();

	return useMemo(() => {
		const courseData = studentCourses?.find((c) => c.id === courseId);
		const attendedOfferings = courseData?.offerings || [];
		const attendedCourseId = courseData?.id;

		const ratedOffering =
			attendedOfferings.find(
				(offering: InlineCourseOffering) =>
					offering.rated !== null && offering.rated !== undefined,
			) || null;

		const rating = ratedOffering?.rated || null;
		const ratingId = rating?.id;
		const selectedOffering = ratedOffering || attendedOfferings[0] || null;
		const hasAttendedCourse = attendedOfferings.length > 0;

		return {
			rating,
			ratingId,
			ratedOffering,
			attendedOfferings,
			hasAttendedCourse,
			selectedOffering,
			attendedCourseId,
			isLoading,
		};
	}, [studentCourses, courseId, isLoading]);
}
