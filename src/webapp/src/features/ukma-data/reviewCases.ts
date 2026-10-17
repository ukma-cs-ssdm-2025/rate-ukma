import {
	type UkmaDataReviewCase,
	UkmaDataReviewCaseKindEnum,
	UkmaDataReviewCaseStatusEnum,
} from "@/lib/api/generated";

// UKMA Data's largest page; the proxy caps a bigger limit to it anyway.
export const PAGE = { limit: 1000 } as const;
// A 502 or 503 shows its own state with a Retry button at once, not after
// three backoffs.
export const NO_RETRY = { query: { retry: false } } as const;

export const caseKinds = Object.values(UkmaDataReviewCaseKindEnum);
export const caseStatuses = Object.values(UkmaDataReviewCaseStatusEnum);

export const CASE_KIND_LABELS: Record<UkmaDataReviewCaseKindEnum, string> = {
	course_match: "Збіг курсу",
	instructor_match: "Викладач",
	removals_held: "Утримані вилучення",
};

export const CASE_STATUS_LABELS: Record<UkmaDataReviewCaseStatusEnum, string> =
	{
		open: "Відкрита",
		decided: "Вирішена",
		obsolete: "Неактуальна",
	};

export const SAFE_ANSWER_LABELS: Record<UkmaDataReviewCaseKindEnum, string> = {
	course_match: "окремий курс",
	instructor_match: "без звʼязку з викладачем",
	removals_held: "нічого не вилучено",
};

// Every field of a generated read-only model is optional, though the proxy
// always sends it.
export const kindLabel = (kind: UkmaDataReviewCaseKindEnum | undefined) =>
	kind ? CASE_KIND_LABELS[kind] : "—";
export const statusLabel = (
	status: UkmaDataReviewCaseStatusEnum | undefined,
) => (status ? CASE_STATUS_LABELS[status] : "—");

export interface CaseFilter {
	readonly kind?: UkmaDataReviewCaseKindEnum;
	readonly status?: UkmaDataReviewCaseStatusEnum;
}

/** The proxy has no filters, so the list filters the page it got. */
export function filterCases(
	cases: ReadonlyArray<UkmaDataReviewCase>,
	{ kind, status }: CaseFilter,
): UkmaDataReviewCase[] {
	return cases.filter(
		(item) =>
			(kind === undefined || item.kind === kind) &&
			(status === undefined || item.status === status),
	);
}

const dateTime = new Intl.DateTimeFormat("uk-UA", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "Europe/Kyiv",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
