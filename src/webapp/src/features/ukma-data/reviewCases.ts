import {
	UkmaDataReviewCaseKindEnum,
	UkmaDataReviewCaseStatusEnum,
} from "@/lib/api/generated";

export const PAGE = { limit: 1000 } as const;
export const NO_RETRY = { query: { retry: false } } as const;

export const caseKinds = Object.values(UkmaDataReviewCaseKindEnum);
export const caseStatuses = Object.values(UkmaDataReviewCaseStatusEnum);

export const CASE_KIND_LABELS: Record<UkmaDataReviewCaseKindEnum, string> = {
	course_match: "Збіг курсу",
	instructor_match: "Викладач",
	student_match: "Студент",
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
	student_match: "запис приєднано до наявного студента",
	removals_held: "нічого не вилучено",
};

export const kindLabel = (kind: UkmaDataReviewCaseKindEnum) =>
	CASE_KIND_LABELS[kind];
export const statusLabel = (status: UkmaDataReviewCaseStatusEnum) =>
	CASE_STATUS_LABELS[status];

const dateTime = new Intl.DateTimeFormat("uk-UA", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "Europe/Kyiv",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
