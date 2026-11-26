import { useState } from "react";

import { Link, useNavigate } from "@tanstack/react-router";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import type { UkmaDataReviewCase } from "@/lib/api/generated";
import {
	useUkmaDataReviewCasesList,
	useUkmaDataStatusRetrieve,
} from "@/lib/api/generated";
import { stepIndex } from "../caseScreen";
import {
	caseDetail,
	caseListParams,
	caseTitle,
	NO_RETRY,
	PAGE,
	sortCases,
	STATUS_LABELS,
} from "../reviewCases";
import { CaseOutcome, CaseTechDetails } from "./CaseDetails";
import { CaseSubjects } from "./CasePeople";
import { useCaseFilterParams, useCaseSearch } from "./ReviewCaseList";
import { UkmaDataError } from "./UkmaDataError";

const STATUS_VARIANTS = {
	open: "soft",
	decided: "success",
	obsolete: "outline",
} as const;

function useCaseLookup(caseId: string) {
	const [filters] = useCaseFilterParams();
	const filtered = useUkmaDataReviewCasesList(
		caseListParams(filters),
		NO_RETRY,
	);
	const order = sortCases(filtered.data?.items ?? []);
	const inOrder = order.find((item) => item.id === caseId);
	const needsAll = filtered.isSuccess && inOrder === undefined;
	const all = useUkmaDataReviewCasesList(PAGE, {
		query: { retry: false, enabled: needsAll },
	});
	const source = needsAll ? all : filtered;
	const found = inOrder ?? all.data?.items.find((item) => item.id === caseId);
	const [kept, setKept] = useState(found);
	if (found !== undefined && found !== kept) {
		setKept(found);
	}
	const reviewCase =
		found ?? (source.isFetching && kept?.id === caseId ? kept : undefined);
	return {
		source,
		reviewCase,
		order: (inOrder ? order : sortCases(all.data?.items ?? [])).map(
			(item) => item.id,
		),
	};
}

function CaseBody({
	reviewCase,
	order,
	decideEnabled,
}: Readonly<{
	reviewCase: UkmaDataReviewCase;
	order: readonly string[];
	decideEnabled: boolean;
}>) {
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
	return (
		<div className="space-y-5">
			<div>
				<Link
					to="/data/cases"
					search={search}
					className="text-sm text-primary hover:underline"
				>
					Усі справи
				</Link>
				<h1 className="mt-1 text-xl font-semibold">{caseTitle(reviewCase)}</h1>
				<p className="text-sm text-muted-foreground">
					Справа {index + 1} з {order.length}
				</p>
			</div>
			<div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
				<Badge variant={STATUS_VARIANTS[reviewCase.status]}>
					{STATUS_LABELS[reviewCase.status]}
				</Badge>
				<span>{caseDetail(reviewCase)}</span>
			</div>
			<CaseSubjects reviewCase={reviewCase} />
			<CaseOutcome reviewCase={reviewCase} decideEnabled={decideEnabled} />
			<div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
				<Button
					size="lg"
					variant="outline"
					disabled={previous === null}
					onClick={() => open(previous)}
				>
					Попередня
				</Button>
				<Button size="lg" disabled={next === null} onClick={() => open(next)}>
					Наступна
				</Button>
			</div>
			<CaseTechDetails reviewCase={reviewCase} />
		</div>
	);
}

export function ReviewCasePage({ caseId }: Readonly<{ caseId: string }>) {
	const { source, reviewCase, order } = useCaseLookup(caseId);
	const status = useUkmaDataStatusRetrieve(NO_RETRY);
	const decideEnabled = status.data?.scopes.includes("review:decide") ?? false;
	if (source.error) {
		return (
			<UkmaDataError
				error={source.error}
				title="Не вдалося завантажити справу"
				onRetry={() => void source.refetch()}
				isRetrying={source.isRefetching}
			/>
		);
	}
	if (reviewCase !== undefined) {
		return (
			<CaseBody
				reviewCase={reviewCase}
				order={order}
				decideEnabled={decideEnabled}
			/>
		);
	}
	if (source.isLoading) {
		return <Skeleton className="h-96 rounded-xl" />;
	}
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyTitle>Справу не знайдено</EmptyTitle>
				<EmptyDescription>
					Можливо, її вже вирішено або дані в САЗ змінились.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
