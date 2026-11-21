import { Skeleton } from "@/components/ui/Skeleton";
import {
	ReviewCaseFilters,
	ReviewCaseList,
	useCaseFilterParams,
} from "./ReviewCaseList";
import { UkmaDataError } from "./UkmaDataError";
import { filterCases, NO_RETRY, PAGE } from "../reviewCases";
import { useUkmaDataReviewCasesList } from "@/lib/api/generated";

export function ReviewCasesPage() {
	const [{ kind, status }] = useCaseFilterParams();
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataReviewCasesList(PAGE, NO_RETRY);
	return (
		<div className="space-y-4">
			<ReviewCaseFilters />
			{isLoading ? (
				<Skeleton className="h-64 rounded-xl" />
			) : data && !error ? (
				<>
					<ReviewCaseList
						cases={filterCases(data.items ?? [], {
							kind: kind === "all" ? undefined : kind,
							status: status === "all" ? undefined : status,
						})}
					/>
					{data.has_more ? (
						<p className="text-sm text-muted-foreground">
							Показано перші {PAGE.limit} справ.
						</p>
					) : null}
				</>
			) : (
				<UkmaDataError
					error={error}
					title="Не вдалося завантажити справи"
					onRetry={refetch}
					isRetrying={isRefetching}
				/>
			)}
		</div>
	);
}
