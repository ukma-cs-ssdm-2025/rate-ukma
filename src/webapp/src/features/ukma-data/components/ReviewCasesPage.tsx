import { useUkmaDataReviewCasesList } from "@/lib/api/generated";
import type { UkmaDataReviewCasePage } from "@/lib/api/generated";
import { useCaseCounts } from "../hooks/useCaseCounts";
import type { CaseCounts } from "../hooks/useCaseCounts";
import {
	caseListParams,
	DECIDED_ELSEWHERE,
	filterCases,
	NO_RETRY,
	pageSlice,
	rangeText,
	sortCases,
} from "../reviewCases";
import { formatCount, freshnessText } from "../syncFormat";
import { CaseExplainer } from "./CaseExplainer";
import { DataPager } from "./DataBits";
import { DataLead } from "./DataLead";
import { DataTableEmpty, DataTableSkeleton } from "./DataTable";
import {
	ReviewCaseFilters,
	ReviewCaseTable,
	useCaseFilterParams,
} from "./ReviewCaseList";
import { UkmaDataError } from "./UkmaDataError";

function CasesBody({
	data,
	counts,
}: Readonly<{ data: UkmaDataReviewCasePage; counts: CaseCounts }>) {
	const [filters, setParams] = useCaseFilterParams();
	const matching = sortCases(filterCases(data.items, filters));
	const { rows, page, totalPages } = pageSlice(matching, filters.page);
	const nothingAtAll = counts.status.all === 0;
	return (
		<div className="space-y-4">
			<ReviewCaseFilters counts={counts} />
			{rows.length === 0 ? (
				<DataTableEmpty>
					{nothingAtAll
						? "Справ немає: усе, що прийшло з САЗ, вирішилось саме."
						: "За цим фільтром справ немає"}
				</DataTableEmpty>
			) : (
				<>
					<ReviewCaseTable cases={rows} />
					<DataPager
						summary={rangeText(page, rows.length, matching.length)}
						page={page}
						totalPages={totalPages}
						onPage={(value) => void setParams({ page: value })}
					/>
				</>
			)}
			{data.has_more ? (
				<p className="text-sm text-muted-foreground">
					Показано перші {formatCount(data.items.length)} з{" "}
					{formatCount(data.total)} справ.
				</p>
			) : null}
		</div>
	);
}

export function ReviewCasesPage() {
	const [filters] = useCaseFilterParams();
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataReviewCasesList(caseListParams(filters), NO_RETRY);
	const counts = useCaseCounts(filters.status);
	return (
		<div className="min-w-0 space-y-6">
			<DataLead
				title="Справи"
				subtitle={
					data && !error ? freshnessText(data.data_updated_at, null) : null
				}
				remaining={counts.remaining}
			/>
			<p className="text-sm text-muted-foreground">{DECIDED_ELSEWHERE}</p>
			<CaseExplainer />
			{isLoading ? <DataTableSkeleton /> : null}
			{data && !error ? <CasesBody data={data} counts={counts} /> : null}
			{error ? (
				<UkmaDataError
					error={error}
					title="Не вдалося завантажити справи"
					onRetry={() => void refetch()}
					isRetrying={isRefetching}
				/>
			) : null}
		</div>
	);
}
