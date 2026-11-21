import { Skeleton } from "@/components/ui/Skeleton";
import {
	ReviewCaseFilters,
	ReviewCaseList,
	useCaseFilterParams,
} from "./ReviewCaseList";
import { UkmaDataError } from "./UkmaDataError";
import { NO_RETRY, PAGE } from "../reviewCases";
import { useUkmaDataReviewCasesList } from "@/lib/api/generated";

export function ReviewCasesPage() {
	const [{ kind, status }] = useCaseFilterParams();
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataReviewCasesList(
			{
				...PAGE,
				kind: kind === "all" ? undefined : kind,
				status: status === "all" ? undefined : status,
			},
			NO_RETRY,
		);
	return (
		<div className="space-y-4">
			<ReviewCaseFilters />
			{isLoading ? (
				<Skeleton className="h-64 rounded-xl" />
			) : data && !error ? (
				<>
					<ReviewCaseList cases={data.items} />
					{data.has_more ? (
						<p className="text-sm text-muted-foreground">
							Показано перші {data.items.length} з {data.total} справ.
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
