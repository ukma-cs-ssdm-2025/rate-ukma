import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ukmaDataClient } from "../api/client";
import type { CaseFilter, DecisionInput } from "../api/schemas";

const ROOT = ["ukma-data"] as const;

export function useUkmaDataOverview() {
	return useQuery({
		queryKey: [...ROOT, "overview"],
		queryFn: () => ukmaDataClient.overview(),
	});
}

export function useReviewCases(filter: CaseFilter) {
	return useQuery({
		queryKey: [...ROOT, "review-cases", filter],
		queryFn: () => ukmaDataClient.reviewCases(filter),
	});
}

export function useReviewCase(id: string) {
	return useQuery({
		queryKey: [...ROOT, "review-case", id],
		queryFn: () => ukmaDataClient.reviewCase(id),
	});
}

export function useDecisions(filter: { reviewCaseId?: string } = {}) {
	return useQuery({
		queryKey: [...ROOT, "decisions", filter],
		queryFn: () => ukmaDataClient.decisions(filter),
	});
}

export function useDecide() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: DecisionInput) => ukmaDataClient.decide(input),
		// A decision moves counts, lists and the trail at once.
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ROOT }),
	});
}
