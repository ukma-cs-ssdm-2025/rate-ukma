import { useStudentsMeRatingSuggestionsList } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth/useAuth";
import { useRatingFlowEnabled } from "./useRatingFlowEnabled";

export function useRatingSuggestions(excludeCourse?: string, enabled = true) {
	const { isStudent } = useAuth();
	const flowEnabled = useRatingFlowEnabled();
	return useStudentsMeRatingSuggestionsList(
		excludeCourse ? { exclude_course: excludeCourse } : undefined,
		{ query: { enabled: enabled && isStudent && flowEnabled } },
	);
}
