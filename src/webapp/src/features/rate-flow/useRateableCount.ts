import { useStudentsMeGradesRetrieve } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * How many of the student's courses can be rated now but are not. Shares the
 * cache with My grades and the rate flow, so the header, the home prompt and
 * the course page cost one request between them.
 */
export function useRateableCount(excludeOfferingId?: string): number {
	const { isStudent } = useAuth();
	const { data } = useStudentsMeGradesRetrieve({
		query: { enabled: isStudent, staleTime: FIVE_MINUTES },
	});
	if (!isStudent || !Array.isArray(data)) return 0;
	return data.filter(
		(row) =>
			row.can_rate &&
			!row.rated &&
			row.course_offering_id !== excludeOfferingId,
	).length;
}
