import { useStudentsMeGradesRateableCountRetrieve } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { useRateFlow } from "./useRateFlow";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * How many of the student's courses can be rated now but are not, from the
 * light count endpoint: the header, the home tile and the course page share
 * one small request instead of the full grades list.
 */
export function useRateableCount(leaveOutCurrent = false): number {
	return useRateableCountState(leaveOutCurrent).count;
}

/** The count plus whether it is still on its way, for places that must not shift when it lands. */
/** `leaveOutCurrent`: the page shows one open, unrated course of its own. */
export function useRateableCountState(leaveOutCurrent = false): {
	count: number;
	isPending: boolean;
} {
	const { isStudent } = useAuth();
	const flow = useRateFlow();
	const on = isStudent && flow.enabled;
	const { data, isPending } = useStudentsMeGradesRateableCountRetrieve({
		query: { enabled: on, staleTime: FIVE_MINUTES },
	});
	// Until the flag resolves the answer is unknown, not zero.
	if (isStudent && !flow.isReady) return { count: 0, isPending: true };
	if (!on) return { count: 0, isPending: false };
	// The endpoint counts every open course; the course on screen may be one.
	const count = Math.max(0, (data?.count ?? 0) - (leaveOutCurrent ? 1 : 0));
	return { count, isPending };
}
