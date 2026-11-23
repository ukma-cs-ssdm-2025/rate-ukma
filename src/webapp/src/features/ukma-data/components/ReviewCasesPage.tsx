import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import {
	useUkmaDataReviewCasesList,
	useUkmaDataStatusRetrieve,
} from "@/lib/api/generated";
import {
	caseListParams,
	DECIDED_ELSEWHERE,
	filterCases,
	NO_RETRY,
	openCasesLine,
	pageSlice,
	rangeText,
	sortCases,
} from "../reviewCases";
import { formatCount } from "../syncFormat";
import {
	ReviewCaseFilters,
	ReviewCaseTable,
	useCaseFilterParams,
} from "./ReviewCaseList";
import { DataSection } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

export function ReviewCasesPage() {
	const [filters, setParams] = useCaseFilterParams();
	const cases = useUkmaDataReviewCasesList(caseListParams(filters), NO_RETRY);
	const status = useUkmaDataStatusRetrieve(NO_RETRY);
	const decideEnabled =
		status.data?.decide_scopes.includes("review:decide") ?? false;
	const matching = sortCases(filterCases(cases.data?.items ?? [], filters));
	const { rows, page, totalPages } = pageSlice(matching, filters.page);
	return (
		<div className="min-w-0 space-y-6">
			<DataSection
				title="Справи"
				lead="Записи, які UKMA Data не зіставила сама: нові студенти, схожі дисципліни та викладачі."
			>
				<p className="text-sm text-muted-foreground">{DECIDED_ELSEWHERE}</p>
				<ReviewCaseFilters />
				{cases.isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
				{cases.error ? (
					<UkmaDataError
						error={cases.error}
						title="Не вдалося завантажити справи"
						onRetry={() => void cases.refetch()}
						isRetrying={cases.isRefetching}
					/>
				) : null}
				{cases.data && !cases.error && rows.length === 0 ? (
					<Empty className="border">
						<EmptyHeader>
							<EmptyTitle>За цим фільтром справ немає</EmptyTitle>
							<EmptyDescription>
								Усі записи, які прийшли з САЗ, уже зіставлено.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : null}
				{cases.data && !cases.error && rows.length > 0 ? (
					<>
						<p className="text-sm text-muted-foreground">
							{filters.status === "open"
								? `${openCasesLine(cases.data.total)}.`
								: `Справ за фільтром: ${formatCount(cases.data.total)}.`}
						</p>
						<ReviewCaseTable cases={rows} decideEnabled={decideEnabled} />
						{totalPages > 1 ? (
							<div className="flex flex-wrap items-center justify-between gap-2 text-sm">
								<span className="text-muted-foreground">
									{rangeText(page, rows.length, matching.length)}
								</span>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										disabled={page <= 1}
										onClick={() => void setParams({ page: page - 1 })}
									>
										Назад
									</Button>
									<Button
										variant="outline"
										size="sm"
										disabled={page >= totalPages}
										onClick={() => void setParams({ page: page + 1 })}
									>
										Далі
									</Button>
								</div>
							</div>
						) : null}
					</>
				) : null}
			</DataSection>
		</div>
	);
}
