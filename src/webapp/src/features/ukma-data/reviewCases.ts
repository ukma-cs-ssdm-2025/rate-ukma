import * as z from "zod";

import {
	UkmaDataReviewCaseKindEnum,
	UkmaDataReviewCaseStatusEnum,
} from "@/lib/api/generated";
import type {
	UkmaDataReviewCase,
	UkmaDataReviewCasesListParams,
} from "@/lib/api/generated";
import { formatCount, pluralForm } from "./syncFormat";
import type { PluralForms } from "./syncFormat";

export const PAGE = { limit: 1000 } as const;
export const NO_RETRY = { query: { retry: false } } as const;
export const ROWS_PER_PAGE = 20;

export const caseKinds = Object.values(UkmaDataReviewCaseKindEnum);
export const caseStatuses = Object.values(UkmaDataReviewCaseStatusEnum);

export const KIND_SEGMENTS = {
	student_match: "Студенти",
	removals_held: "Зниклі семестри",
	course_match: "Дисципліни",
	instructor_match: "Викладачі",
} satisfies Record<UkmaDataReviewCaseKindEnum, string>;

export const STATUS_SEGMENTS = {
	open: "Чекають",
	decided: "Вирішені",
	obsolete: "Неактуальні",
} satisfies Record<UkmaDataReviewCaseStatusEnum, string>;

export const STATUS_LABELS = {
	open: "Чекає рішення",
	decided: "Вирішено",
	obsolete: "Неактуальна",
} satisfies Record<UkmaDataReviewCaseStatusEnum, string>;

const CASES = {
	one: "справа",
	few: "справи",
	many: "справ",
} satisfies PluralForms;

const STUDENTS_WITH = {
	one: "студентом",
	few: "студентами",
	many: "студентами",
} satisfies PluralForms;

const SEMESTERS = {
	one: "семестр",
	few: "семестри",
	many: "семестрів",
} satisfies PluralForms;

const DAYS = { one: "день", few: "дні", many: "днів" } satisfies PluralForms;

export const READ_ONLY = "Тут лише перегляд: рішення змінюють спільні дані САЗ";

export const DECIDED_ELSEWHERE =
	"Рішення приймають на сторінці справи, де видно імена й назви. Вони змінюють спільні дані САЗ, тому кнопки працюють, лише коли ключ сервера має на це право.";

const countWord = (count: number, forms: PluralForms): string =>
	`${formatCount(count)} ${pluralForm(count, forms)}`;

const idList = z.array(z.string());
const candidateShape = z.union([
	idList,
	z
		.object({ academicYear: z.number().optional() })
		.catchall(z.unknown())
		.transform((value) => ({
			academicYear: value.academicYear ?? null,
			ids: Object.values(value).flatMap((item) => {
				const parsed = idList.safeParse(item);
				return parsed.success ? parsed.data : [];
			}),
		})),
]);

function parseCandidates(reviewCase: UkmaDataReviewCase) {
	const parsed = candidateShape.safeParse(reviewCase.candidates);
	if (!parsed.success) {
		return { academicYear: null, ids: [] };
	}
	return Array.isArray(parsed.data)
		? { academicYear: null, ids: parsed.data }
		: parsed.data;
}

export const candidateIds = (reviewCase: UkmaDataReviewCase): string[] =>
	parseCandidates(reviewCase).ids;

export const academicYear = (reviewCase: UkmaDataReviewCase): number | null =>
	parseCandidates(reviewCase).academicYear;

const yearText = (year: number | null): string =>
	year === null ? "" : ` ${year}–${year + 1}`;

export function waitedFor(iso: string, now: number = Date.now()): string {
	const hours = (now - Date.parse(iso)) / 3_600_000;
	if (hours < 24) {
		return "менше доби";
	}
	return countWord(Math.floor(hours / 24), DAYS);
}

export function caseTitle(reviewCase: UkmaDataReviewCase): string {
	const count = candidateIds(reviewCase).length;
	switch (reviewCase.kind) {
		case "student_match":
			return "Новий запис студента схожий на наявного";
		case "removals_held":
			return `САЗ більше не показує ${countWord(count, SEMESTERS)}${yearText(academicYear(reviewCase))}`;
		case "course_match":
			return "Семестр із САЗ схожий на кілька дисциплін";
		case "instructor_match":
			return "Викладача з САЗ не вдалося впізнати";
	}
}

export function caseDetail(reviewCase: UkmaDataReviewCase): string {
	const count = candidateIds(reviewCase).length;
	switch (reviewCase.kind) {
		case "student_match":
			return `Збігся з ${countWord(count, STUDENTS_WITH)}`;
		case "removals_held":
			return "Сайт їх поки не прибирає";
		case "course_match":
		case "instructor_match":
			return `Схожих варіантів: ${formatCount(count)}`;
	}
}

export const openCasesLine = (count: number): string =>
	`${countWord(count, CASES)} ${pluralForm(count, { one: "чекає", few: "чекають", many: "чекають" })} рішення`;

export interface CaseFilters {
	kind: UkmaDataReviewCaseKindEnum | "all";
	status: UkmaDataReviewCaseStatusEnum | "all";
}

export function filterCases(
	cases: readonly UkmaDataReviewCase[],
	{ kind, status }: CaseFilters,
): UkmaDataReviewCase[] {
	return cases.filter(
		(item) =>
			(kind === "all" || item.kind === kind) &&
			(status === "all" || item.status === status),
	);
}

export interface PageSlice<T> {
	rows: T[];
	page: number;
	totalPages: number;
}

export function pageSlice<T>(items: readonly T[], page: number): PageSlice<T> {
	const totalPages = Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
	const current = Math.min(Math.max(1, page), totalPages);
	const start = (current - 1) * ROWS_PER_PAGE;
	return {
		rows: items.slice(start, start + ROWS_PER_PAGE),
		page: current,
		totalPages,
	};
}

export function rangeText(page: number, shown: number, total: number): string {
	const start = (page - 1) * ROWS_PER_PAGE + 1;
	return `${formatCount(start)}–${formatCount(start + shown - 1)} з ${formatCount(total)}`;
}

const dateTime = new Intl.DateTimeFormat("uk-UA", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "Europe/Kyiv",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

const dayMonth = new Intl.DateTimeFormat("uk-UA", {
	day: "numeric",
	month: "short",
	timeZone: "Europe/Kyiv",
});

export const receivedText = (iso: string): string =>
	`Отримано ${dayMonth.format(new Date(iso))}`;

const openedTime = (item: UkmaDataReviewCase): number =>
	Date.parse(item.opened_at);

export function sortCases(
	cases: readonly UkmaDataReviewCase[],
): UkmaDataReviewCase[] {
	const open = cases.filter((item) => item.status === "open");
	const closed = cases.filter((item) => item.status !== "open");
	return [
		...open.sort((a, b) => openedTime(a) - openedTime(b)),
		...closed.sort((a, b) => openedTime(b) - openedTime(a)),
	];
}

export function caseListParams({
	kind,
	status,
}: Pick<CaseFilters, "kind" | "status">): UkmaDataReviewCasesListParams {
	return {
		...PAGE,
		kind: kind === "all" ? undefined : kind,
		status: status === "all" ? undefined : status,
	};
}
