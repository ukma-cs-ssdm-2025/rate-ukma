import { useQueries } from "@tanstack/react-query";

import {
	getUkmaDataReviewCasesListQueryOptions,
	useUkmaDataReviewCasesList,
} from "@/lib/api/generated";
import type {
	UkmaDataReviewCaseKindEnum,
	UkmaDataReviewCaseStatusEnum,
} from "@/lib/api/generated";
import { caseKinds, caseListParams, NO_RETRY } from "../reviewCases";
import type { CaseFilters } from "../reviewCases";

const COUNT_ONLY = { limit: 1 } as const;

export interface CaseCounts {
	remaining: number | undefined;
	status: Partial<Record<UkmaDataReviewCaseStatusEnum | "all", number>>;
	kind: Partial<Record<UkmaDataReviewCaseKindEnum | "all", number>>;
}

export function useCaseCounts(status: CaseFilters["status"]): CaseCounts {
	const open = useUkmaDataReviewCasesList(
		caseListParams({ kind: "all", status: "open" }),
		NO_RETRY,
	);
	const [decided, obsolete] = useQueries({
		queries: (["decided", "obsolete"] as const).map((closed) =>
			getUkmaDataReviewCasesListQueryOptions(
				{ ...COUNT_ONLY, status: closed },
				NO_RETRY,
			),
		),
	});
	const kinds = useQueries({
		queries: caseKinds.map((kind) =>
			getUkmaDataReviewCasesListQueryOptions(
				{
					...COUNT_ONLY,
					kind,
					status: status === "all" ? undefined : status,
				},
				NO_RETRY,
			),
		),
	});
	const remaining = open.error ? undefined : open.data?.total;
	const closedTotal = (query: typeof decided) =>
		query.error ? undefined : query.data?.total;
	const statusCounts = {
		open: remaining,
		decided: closedTotal(decided),
		obsolete: closedTotal(obsolete),
	};
	const kindCounts = Object.fromEntries(
		caseKinds.map((kind, index) => [kind, closedTotal(kinds[index])]),
	);
	return {
		remaining,
		status: { ...statusCounts, all: sumOf(Object.values(statusCounts)) },
		kind: { ...kindCounts, all: sumOf(Object.values(kindCounts)) },
	};
}

function sumOf(values: readonly (number | undefined)[]): number | undefined {
	return values.reduce<number | undefined>(
		(sum, value) =>
			sum === undefined || value === undefined ? undefined : sum + value,
		0,
	);
}
