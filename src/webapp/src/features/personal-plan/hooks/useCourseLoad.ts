import { useCoursesOfferingsList } from "@/lib/api/generated";
import {
	type CourseLoad,
	offeringForTerm,
	offeringLoad,
} from "../planOffering";
import type { PlanTerm } from "../planTypes";

const OFFERINGS_STALE_TIME = 10 * 60 * 1000;

/**
 * Credits and weekly hours of a catalog course in the given term.
 *
 * The course list carries no load, so each row asks for its offerings.
 * Drop this once `/courses/` returns credits and hours itself.
 */
export function useCourseLoad(
	courseId: string,
	term: PlanTerm,
): CourseLoad & { isLoading: boolean } {
	const { data, isLoading } = useCoursesOfferingsList(courseId, {
		query: { staleTime: OFFERINGS_STALE_TIME },
	});
	const offering = offeringForTerm(data?.course_offerings ?? [], term);
	return { ...offeringLoad(offering, term), isLoading };
}
