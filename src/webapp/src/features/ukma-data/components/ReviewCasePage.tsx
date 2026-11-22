import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, SearchX } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/Button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { useUkmaDataReviewCasesList } from "@/lib/api/generated";
import type { UkmaDataReviewCase } from "@/lib/api/generated";
import { stepIndex } from "../caseScreen";
import {
	caseDetail,
	caseListParams,
	caseTitle,
	DECIDED_ELSEWHERE,
	filterCases,
	NO_RETRY,
	PAGE,
	STATUS_LABELS,
	sortCases,
	STATUS_TONES,
} from "../reviewCases";
import { formatCount } from "../syncFormat";
import { CaseOutcome, CaseSides, CaseTechDetails } from "./CaseDetails";
import { DataBack, DataChip, Kbd } from "./DataBits";
import { DeskHead, useDeskKeys } from "./DataDesk";
import { DataTableSkeleton } from "./DataTable";
import { useCaseFilterParams, useCaseSearch } from "./ReviewCaseList";
import { UkmaDataError } from "./UkmaDataError";

function useCaseLookup(caseId: string) {
	const [filters] = useCaseFilterParams();
	const filtered = useUkmaDataReviewCasesList(
		caseListParams(filters),
		NO_RETRY,
	);
	const order = sortCases(filterCases(filtered.data?.items ?? [], filters));
	const inOrder = order.find((item) => item.id === caseId);
	const needsAll = filtered.isSuccess && inOrder === undefined;
	const all = useUkmaDataReviewCasesList(PAGE, {
		query: { retry: false, enabled: needsAll },
	});
	const source = needsAll ? all : filtered;
	const reviewCase =
		inOrder ?? all.data?.items.find((item) => item.id === caseId);
	return {
		source,
		reviewCase,
		order: (inOrder ? order : sortCases(all.data?.items ?? [])).map(
			(item) => item.id,
		),
	};
}

function CaseDesk({
	reviewCase,
	order,
}: Readonly<{ reviewCase: UkmaDataReviewCase; order: readonly string[] }>) {
	const navigate = useNavigate();
	const search = useCaseSearch();
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
			<p className="text-sm text-muted-foreground">{DECIDED_ELSEWHERE}</p>
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

function CaseNotFound({ searchedSome }: Readonly<{ searchedSome: boolean }>) {
	const search = useCaseSearch();
	return (
		<Empty className="border-0 py-16">
			<EmptyHeader>
				<EmptyMedia variant="icon" className="text-destructive">
					<SearchX />
				</EmptyMedia>
				<EmptyTitle>Справи не знайдено</EmptyTitle>
				<EmptyDescription>
					{searchedSome
						? `Шукали серед перших ${formatCount(PAGE.limit)} справ.`
						: "Можливо, її вже прибрали."}
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link to="/data/cases" search={search} className={buttonVariants()}>
					До списку справ
				</Link>
			</EmptyContent>
		</Empty>
	);
}

export function ReviewCasePage({ caseId }: Readonly<{ caseId: string }>) {
	const { source, reviewCase, order } = useCaseLookup(caseId);
	const { data, isLoading, isPending, error, refetch, isRefetching } = source;
	if (isLoading || (isPending && !error)) {
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
	if (!reviewCase) {
		return <CaseNotFound searchedSome={data.has_more} />;
	}
	return <CaseDesk reviewCase={reviewCase} order={order} />;
}
