import { useStudentsMeGradesRetrieve } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * How many of the student's courses can be rated now but are not. Shares the
 * cache with My grades and the rate flow, so the header, the home prompt and
 * the course page cost one request between them.
 */
export function useRateableCount(excludeOfferingId?: string): number {
	return useRateableCountState(excludeOfferingId).count;
}

/** The count plus whether it is still on its way, for places that must not shift when it lands. */
export function useRateableCountState(excludeOfferingId?: string): {
	count: number;
	isPending: boolean;
} {
	const { isStudent } = useAuth();
	const { data, isPending } = useStudentsMeGradesRetrieve({
		query: { enabled: isStudent, staleTime: FIVE_MINUTES },
	});
	if (!isStudent) return { count: 0, isPending: false };
	if (!Array.isArray(data)) return { count: 0, isPending };
	const count = data.filter(
		(row) =>
			row.can_rate &&
			!row.rated &&
			row.course_offering_id !== excludeOfferingId,
	).length;
	return { count, isPending: false };
}
