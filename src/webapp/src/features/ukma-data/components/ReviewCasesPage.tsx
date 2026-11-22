import { useUkmaDataReviewCasesList } from "@/lib/api/generated";
import type { UkmaDataReviewCasePage } from "@/lib/api/generated";
import {
	filterCases,
	NO_RETRY,
	PAGE,
	pageSlice,
	rangeText,
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

function CasesBody({ data }: Readonly<{ data: UkmaDataReviewCasePage }>) {
	const [filters, setParams] = useCaseFilterParams();
	const matching = filterCases(data.items, filters);
	const { rows, page, totalPages } = pageSlice(matching, filters.page);
	return (
		<div className="space-y-4">
			<ReviewCaseFilters cases={data.items} />
			{data.items.length === 0 ? (
				<DataTableEmpty>
					Справ немає: усе, що прийшло з САЗ, вирішилось саме.
				</DataTableEmpty>
			) : rows.length === 0 ? (
				<DataTableEmpty>За цим фільтром справ немає</DataTableEmpty>
			) : (
				<ReviewCaseTable cases={rows} />
			)}
			<DataPager
				summary={rangeText(page, rows.length, matching.length)}
				page={page}
				totalPages={totalPages}
				onPage={(value) => void setParams({ page: value })}
			/>
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
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataReviewCasesList(PAGE, NO_RETRY);
	const remaining =
		data && !error
			? data.items.filter((item) => item.status === "open").length
			: undefined;
	return (
		<div className="min-w-0 space-y-6">
			<DataLead
				title="Справи"
				subtitle={
					data && !error ? freshnessText(data.data_updated_at, null) : null
				}
				remaining={remaining}
			/>
			<CaseExplainer />
			{isLoading ? <DataTableSkeleton /> : null}
			{data && !error ? <CasesBody data={data} /> : null}
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
