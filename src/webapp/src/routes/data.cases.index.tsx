import { createFileRoute } from "@tanstack/react-router";

import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	ReviewCaseFilters,
	ReviewCaseList,
	useCaseFilterParams,
} from "@/features/ukma-data/components/ReviewCaseList";
import { useReviewCases } from "@/features/ukma-data/hooks/useUkmaData";

function ReviewCases() {
	const [{ kind, status }] = useCaseFilterParams();
	const { data, isLoading, isError, refetch, isRefetching } = useReviewCases({
		kind: kind === "all" ? undefined : kind,
		status: status === "all" ? undefined : status,
	});
	return (
		<div className="space-y-4">
			<ReviewCaseFilters />
			{isLoading ? (
				<Skeleton className="h-64 rounded-xl" />
			) : isError || !data ? (
				<ErrorState
					title="Не вдалося завантажити справи"
					onRetry={refetch}
					isRetrying={isRefetching}
				/>
			) : (
				<ReviewCaseList cases={data} />
			)}
		</div>
	);
}

export const Route = createFileRoute("/data/cases/")({
	component: ReviewCases,
});
