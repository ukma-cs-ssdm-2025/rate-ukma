import * as z from "zod";

import {
	UkmaDataReviewCaseKindEnum,
	UkmaDataReviewCaseStatusEnum,
} from "@/lib/api/generated";
import type { UkmaDataReviewCase } from "@/lib/api/generated";
import {
	formatCount,
	formatHoursAgo,
	hoursSince,
	pluralForm,
} from "./syncFormat";
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

export const STATUS_TONES = {
	open: "primary",
	decided: "success",
	obsolete: "muted",
} as const satisfies Record<UkmaDataReviewCaseStatusEnum, string>;

const CASES = {
	one: "справа",
	few: "справи",
	many: "справ",
} satisfies PluralForms;

const ABOUT = {
	student_match: {
		one: "про студента",
		few: "про студентів",
		many: "про студентів",
	},
	removals_held: {
		one: "про зниклі з САЗ семестри",
		few: "про зниклі з САЗ семестри",
		many: "про зниклі з САЗ семестри",
	},
	course_match: {
		one: "про дисципліну",
		few: "про дисципліни",
		many: "про дисципліни",
	},
	instructor_match: {
		one: "про викладача",
		few: "про викладачів",
		many: "про викладачів",
	},
} satisfies Record<UkmaDataReviewCaseKindEnum, PluralForms>;

const KIND_MEANING = {
	student_match:
		"Новий запис зі списків САЗ схожий на студента, який уже є. Поки ви не вирішите, запис приєднано до найближчого збігу.",
	removals_held:
		"САЗ перестала показувати ці семестри. Поки ви не вирішите, сайт їх не прибирає.",
	course_match:
		"Семестр із САЗ схожий на кілька дисциплін. Поки ви не вирішите, він стоїть як окрема дисципліна.",
	instructor_match:
		"Викладача з САЗ не вдалося однозначно впізнати. Поки ви не вирішите, семестр показано без нього.",
} satisfies Record<UkmaDataReviewCaseKindEnum, string>;

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

const OPTIONS = {
	one: "варіант",
	few: "варіанти",
	many: "варіантів",
} satisfies PluralForms;

const DAYS = { one: "день", few: "дні", many: "днів" } satisfies PluralForms;

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
	const hours = hoursSince(iso, now);
	if (hours < 24) {
		return "менше доби";
	}
	return countWord(Math.floor(hours / 24), DAYS);
}

export const sinceText = (iso: string, now: number = Date.now()): string =>
	formatHoursAgo(hoursSince(iso, now));

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
			return `${countWord(count, OPTIONS)} на вибір`;
	}
}

export function openLineTitle(
	kind: UkmaDataReviewCaseKindEnum,
	count: number,
	oldest: string | null,
	now: number = Date.now(),
): string {
	const verb = pluralForm(count, {
		one: "чекає",
		few: "чекають",
		many: "чекають",
	});
	const age =
		oldest === null ? "" : ` (найстаріша — ${waitedFor(oldest, now)})`;
	return `${countWord(count, CASES)} ${pluralForm(count, ABOUT[kind])} ${verb} рішення${age}`;
}

export const kindMeaning = (kind: UkmaDataReviewCaseKindEnum): string =>
	KIND_MEANING[kind];

export const casesWaiting = (count: number): string =>
	`${countWord(count, CASES)} ${pluralForm(count, { one: "чекає", few: "чекають", many: "чекають" })} рішення`;

export interface CaseGroup {
	kind: UkmaDataReviewCaseKindEnum;
	count: number;
	oldest: string;
}

export function openGroups(cases: readonly UkmaDataReviewCase[]): CaseGroup[] {
	return caseKinds.flatMap((kind) => {
		const open = cases.filter(
			(item) => item.kind === kind && item.status === "open",
		);
		const oldest = open.reduce<string | null>(
			(min, item) =>
				min === null || item.opened_at < min ? item.opened_at : min,
			null,
		);
		return oldest === null ? [] : [{ kind, count: open.length, oldest }];
	});
}

export interface CaseFilters {
	kind: UkmaDataReviewCaseKindEnum | "all";
	status: UkmaDataReviewCaseStatusEnum | "all";
	q: string;
}

export function filterCases(
	cases: readonly UkmaDataReviewCase[],
	{ kind, status, q }: CaseFilters,
): UkmaDataReviewCase[] {
	const needle = q.trim().toLowerCase();
	return cases.filter(
		(item) =>
			(kind === "all" || item.kind === kind) &&
			(status === "all" || item.status === status) &&
			(needle === "" ||
				`${caseTitle(item)} ${caseDetail(item)}`
					.toLowerCase()
					.includes(needle)),
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
	if (total === 0) {
		return "Нічого не знайдено";
	}
	const start = (page - 1) * ROWS_PER_PAGE + 1;
	return `${formatCount(start)}–${formatCount(start + shown - 1)} з ${formatCount(total)}`;
}

const dateTime = new Intl.DateTimeFormat("uk-UA", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "Europe/Kyiv",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
