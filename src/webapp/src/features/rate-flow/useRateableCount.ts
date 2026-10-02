import { useStudentsMeGradesRateableCountRetrieve } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * How many of the student's courses can be rated now but are not, from the
 * light count endpoint: the header, the home tile and the course page share
 * one small request instead of the full grades list.
 */
export function useRateableCount(): number {
	return useRateableCountState().count;
}

/** The count plus whether it is still on its way, for places that must not shift when it lands. */
export function useRateableCountState(): {
	count: number;
	isPending: boolean;
} {
	const { isStudent } = useAuth();
	const { data, isPending } = useStudentsMeGradesRateableCountRetrieve({
		query: { enabled: isStudent, staleTime: FIVE_MINUTES },
	});
	if (!isStudent) return { count: 0, isPending: false };
	return { count: data?.count ?? 0, isPending };
}
