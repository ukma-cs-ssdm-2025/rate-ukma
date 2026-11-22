import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, SearchX } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { useUkmaDataReviewCasesList } from "@/lib/api/generated";
import type { UkmaDataReviewCase } from "@/lib/api/generated";
import { stepIndex } from "../caseScreen";
import {
	caseDetail,
	caseTitle,
	filterCases,
	NO_RETRY,
	PAGE,
	STATUS_LABELS,
	STATUS_TONES,
} from "../reviewCases";
import { formatCount } from "../syncFormat";
import { CaseOutcome, CaseSides, CaseTechDetails } from "./CaseDetails";
import { DataBack, DataChip, Kbd } from "./DataBits";
import { DeskHead, useDeskKeys } from "./DataDesk";
import { DataTableSkeleton } from "./DataTable";
import { useCaseFilterParams } from "./ReviewCaseList";
import { UkmaDataError } from "./UkmaDataError";

function useCaseOrder(
	cases: readonly UkmaDataReviewCase[],
	caseId: string,
): string[] {
	const [filters] = useCaseFilterParams();
	const filtered = filterCases(cases, filters).map((item) => item.id);
	return filtered.includes(caseId) ? filtered : cases.map((item) => item.id);
}

function CaseDesk({
	reviewCase,
	order,
}: Readonly<{ reviewCase: UkmaDataReviewCase; order: readonly string[] }>) {
	const navigate = useNavigate();
	const [filters] = useCaseFilterParams();
	const search = { kind: filters.kind, status: filters.status, q: filters.q };
	const index = order.indexOf(reviewCase.id);
	const previous = stepIndex(order, reviewCase.id, -1);
	const next = stepIndex(order, reviewCase.id, 1);
	const open = (caseId: string | null) => {
		if (caseId !== null) {
			void navigate({ to: "/data/cases/$caseId", params: { caseId }, search });
		}
	};
	const toList = () => void navigate({ to: "/data/cases", search });
	useDeskKeys(
		{
			ArrowRight: () => open(next),
			ArrowLeft: () => open(previous),
			Escape: toList,
		},
		true,
	);
	return (
		<div className="space-y-5">
			<DataBack onBack={toList}>Усі справи</DataBack>
			<DeskHead
				title={caseTitle(reviewCase)}
				progress={((index + 1) / Math.max(order.length, 1)) * 100}
				label={`Справа ${formatCount(index + 1)} з ${formatCount(order.length)}`}
			/>
			<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<DataChip tone={STATUS_TONES[reviewCase.status]}>
					{STATUS_LABELS[reviewCase.status]}
				</DataChip>
				<span>{caseDetail(reviewCase)}</span>
			</div>
			<CaseSides reviewCase={reviewCase} />
			<CaseOutcome reviewCase={reviewCase} />
			<p className="text-sm text-muted-foreground">
				Рішення ухвалюють у САЗ-даних; тут — перегляд.
			</p>
			<div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
				<Button
					size="lg"
					variant="outline"
					disabled={previous === null}
					onClick={() => open(previous)}
				>
					<ArrowLeft /> Попередня <Kbd>←</Kbd>
				</Button>
				<Button size="lg" disabled={next === null} onClick={() => open(next)}>
					Наступна <ArrowRight /> <Kbd>→</Kbd>
				</Button>
			</div>
			<CaseTechDetails reviewCase={reviewCase} />
		</div>
	);
}

export function ReviewCasePage({ caseId }: Readonly<{ caseId: string }>) {
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataReviewCasesList(PAGE, NO_RETRY);
	const cases = data && !error ? data.items : [];
	const order = useCaseOrder(cases, caseId);
	if (isLoading) {
		return <DataTableSkeleton />;
	}
	if (error || !data) {
		return (
			<UkmaDataError
				error={error}
				title="Не вдалося відкрити справу"
				onRetry={() => void refetch()}
				isRetrying={isRefetching}
			/>
		);
	}
	const reviewCase = cases.find((item) => item.id === caseId);
	if (!reviewCase) {
		return (
			<ErrorState
				icon={SearchX}
				title="Справи не знайдено"
				description={
					data.has_more
						? `Шукали серед перших ${formatCount(PAGE.limit)} справ.`
						: "Можливо, її вже прибрали. Поверніться до списку справ."
				}
			/>
		);
	}
	return <CaseDesk reviewCase={reviewCase} order={order} />;
}
