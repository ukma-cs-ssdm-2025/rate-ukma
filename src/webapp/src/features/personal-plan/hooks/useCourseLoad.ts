import { useCoursesOfferingsList } from "@/lib/api/generated";
import type { SemesterTermEnum } from "@/lib/api/generated";
import { offeringForTerm, offeringLoad } from "../planOffering";
import type { CourseLoad } from "../planOffering";

const OFFERINGS_STALE_TIME = 10 * 60 * 1000;

export function useCourseLoad(
	courseId: string,
	term: SemesterTermEnum,
): CourseLoad & { isLoading: boolean } {
	const { data, isLoading } = useCoursesOfferingsList(courseId, {
		query: { staleTime: OFFERINGS_STALE_TIME },
	});
	const offering = offeringForTerm(data?.course_offerings ?? [], term);
	return { ...offeringLoad(offering, term), isLoading };
}
