import type {
	SyncApprovalDetail,
	SyncChangeGroupEnum,
	SyncPreviewResponse,
	SyncSelectionFilter,
	SyncSummary,
	SyncSummaryAnswers,
	UkmaDataSyncPendingListParams,
} from "@/lib/api/generated";
import {
	CHANGES_ACCUSATIVE,
	countWith,
	formatCount,
	LINKS,
	RATINGS_ACCUSATIVE,
	RECORDS,
} from "./syncFormat";
import { numberAt } from "./sync";

export const REVIEW_STEPS = [
	"exact_links",
	"rated_questions",
	"other_questions",
	"review_links",
	"new_rows",
	"field_changes",
	"removed",
] as const;

export type ReviewStep = (typeof REVIEW_STEPS)[number];

export const LIST_STEPS = [
	"exact_links",
	"review_links",
	"new_rows",
	"removed",
] as const;

export type ListStep = (typeof LIST_STEPS)[number];

export const QUESTION_ENTRIES = [
	"rated_questions",
	"other_questions",
	"answers",
] as const;

export const isReviewStep = (value: string): value is ReviewStep =>
	REVIEW_STEPS.some((step) => step === value);

export const isListStep = (value: string): value is ListStep =>
	LIST_STEPS.some((step) => step === value);

export const STEP_TITLES = {
	exact_links: "Звʼязки з точним збігом",
	rated_questions: "Питання з оцінками",
	other_questions: "Решта питань",
	review_links: "Звʼязки, які варто перевірити",
	new_rows: "Нові курси й курси в семестрі",
	field_changes: "Зміни полів",
	removed: "Зникли з САЗ",
} satisfies Record<ReviewStep, string>;

export const STEP_EFFECTS = {
	exact_links:
		"Записує ідентифікатори UKMA Data в рядки Rate UKMA. Студенти нічого не помітять.",
	rated_questions: "Курси, які UKMA Data вважає одним. Тут вирішуєте лише ви.",
	other_questions:
		"Обʼєднання, курси в семестрі без курсу, перенесення без оцінок.",
	review_links: "Назва в Rate UKMA і в UKMA Data різна.",
	new_rows: "Зʼявляться на сайті як нові сторінки.",
	field_changes: "Оновлює поля курсів у семестрі, які студенти бачать.",
	removed: "Курси, яких більше немає в САЗ. Rate UKMA нічого не видаляє.",
} satisfies Record<ReviewStep, string>;

export const STEP_ACTIONS = {
	exact_links: "Переглянути й застосувати",
	rated_questions: "Почати розгляд",
	other_questions: "Переглянути таблицею",
	review_links: "Переглянути",
	new_rows: "Переглянути",
	field_changes: "Переглянути за полями",
	removed: "Позначити переглянутими",
} satisfies Record<ReviewStep, string>;

export const RISKS = [
	"invisible",
	"visible",
	"moves_ratings",
	"unrated",
] as const;

export type Risk = (typeof RISKS)[number];

export const STEP_RISK = {
	exact_links: "invisible",
	rated_questions: "moves_ratings",
	other_questions: "unrated",
	review_links: "invisible",
	new_rows: "visible",
	field_changes: "visible",
	removed: "invisible",
} satisfies Record<ReviewStep, Risk>;

export const RISK_LABELS = {
	invisible: "Без видимих змін",
	visible: "Видимі зміни",
	moves_ratings: "Переносить оцінки",
	unrated: "Без оцінок",
} satisfies Record<Risk, string>;

export const RISK_BADGE = {
	invisible: "success",
	visible: "secondary",
	moves_ratings: "caution",
	unrated: "outline",
} satisfies Record<Risk, "success" | "secondary" | "caution" | "outline">;

export type StepTarget =
	| { param: "group"; value: ReviewStep }
	| { param: "question"; value: ReviewStep };

export function stepTarget(step: ReviewStep): StepTarget {
	if (step === "rated_questions" || step === "other_questions") {
		return { param: "question", value: step };
	}
	return { param: "group", value: step };
}

export const BIG_APPLY = 1000;
export const SELECTION_LIMIT = 200;

const STEP_GROUP = {
	exact_links: "link",
	review_links: "link",
	new_rows: "new",
	removed: "removed",
} satisfies Record<ListStep, SyncChangeGroupEnum>;

export interface ListState {
	kind: string | null;
	q: string;
	rated: boolean;
	similar: boolean;
}

export function selectionFilter(
	step: ListStep,
	state: ListState,
	purpose: "list" | "bulk",
): SyncSelectionFilter {
	const filter: SyncSelectionFilter = { group: STEP_GROUP[step] };
	if (step === "exact_links") {
		filter.match = "exact";
	}
	if (step === "review_links") {
		filter.match = "review";
	}
	if (state.kind !== null) {
		filter.kind = state.kind;
	}
	if (state.q.trim().length > 0) {
		filter.q = state.q.trim();
	}
	if (state.rated) {
		filter.rated = true;
	}
	if (state.similar) {
		filter.similar_existing = true;
	} else if (purpose === "bulk" && state.kind === "new_course") {
		filter.similar_existing = false;
	}
	return filter;
}

export function pendingParams(
	filter: SyncSelectionFilter,
	view: { source: "catalog" | "teachers"; run: number | null },
	page: { mode: "sample" | "all"; seed: number; page: number; size: number },
): UkmaDataSyncPendingListParams {
	const params: UkmaDataSyncPendingListParams = {
		source: view.source,
		group: filter.group,
		view: page.mode,
		page: page.page,
		page_size: page.size,
	};
	if (view.run !== null) {
		params.run = view.run;
	}
	if (page.mode === "sample") {
		params.seed = page.seed;
	}
	if (filter.kind) {
		params.kind = filter.kind;
	}
	if (filter.match) {
		params.match = filter.match;
	}
	if (filter.q) {
		params.q = filter.q;
	}
	if (filter.rated) {
		params.rated = true;
	}
	if (filter.similar_existing === true) {
		params.similar_existing = true;
	}
	return params;
}

interface StepFacets {
	exact: number | null;
	review: number | null;
	similarExisting: number | null;
}

export function parseFacets(facets: unknown): StepFacets {
	return {
		exact: numberAt(facets, "match", "exact"),
		review: numberAt(facets, "match", "review"),
		similarExisting: numberAt(facets, "similar_existing"),
	};
}

export interface ApprovalCounts {
	applied: number;
	waiting: number;
	superseded: number;
	skipped: number;
	rejected: number;
}

export function approvalCounts(counts: unknown): ApprovalCounts {
	return {
		applied: numberAt(counts, "applied") ?? 0,
		waiting: numberAt(counts, "waiting") ?? 0,
		superseded: numberAt(counts, "superseded") ?? 0,
		skipped: numberAt(counts, "skipped") ?? 0,
		rejected: numberAt(counts, "rejected") ?? 0,
	};
}

export const previewApplyCount = (preview: SyncPreviewResponse): number =>
	Object.values(preview.counts).reduce((sum, item) => sum + item.apply, 0);

export const previewWaitCount = (preview: SyncPreviewResponse): number =>
	Object.values(preview.counts).reduce((sum, item) => sum + item.wait, 0);

export const previewSupersededCount = (preview: SyncPreviewResponse): number =>
	Object.values(preview.counts).reduce((sum, item) => sum + item.superseded, 0);

export function confirmLabel(
	step: ListStep | null,
	preview: SyncPreviewResponse,
): string {
	const count = previewApplyCount(preview);
	let action = `Застосувати ${countWith(count, CHANGES_ACCUSATIVE)}`;
	if (step === "exact_links" || step === "review_links") {
		action = `Застосувати ${countWith(count, LINKS)}`;
	}
	if (step === "new_rows") {
		action = `Створити ${countWith(count, RECORDS)}`;
	}
	if (step === "removed") {
		action = `Позначити ${countWith(count, RECORDS)} переглянутими`;
	}
	if (preview.ratings_moved > 0) {
		const lowered = action.charAt(0).toLowerCase() + action.slice(1);
		return `Перенести ${countWith(preview.ratings_moved, RATINGS_ACCUSATIVE)} й ${lowered}`;
	}
	return action;
}

export const STALE_HOURS = 48;

export const needsStaleTick = (preview: SyncPreviewResponse): boolean =>
	preview.run_age_hours !== null && preview.run_age_hours > STALE_HOURS;

export const needsMoveTick = (preview: SyncPreviewResponse): boolean =>
	preview.ratings_moved > 0 || preview.plans_moved > 0;

export function bulkLabel(count: number | null, seen: number): string {
	const what = count === null ? "за фільтром" : formatCount(count);
	return `Застосувати всі ${what} (переглянуто ${seen})…`;
}

export const summaryTotal = (summary: SyncSummary): number =>
	summary.steps.reduce((sum, step) => sum + step.count, 0);

export const ANSWER_KEYS = [
	"merge",
	"keep_apart",
	"keep",
	"place",
	"move",
] as const satisfies readonly (keyof SyncSummaryAnswers)[];

export const answersTotal = (summary: SyncSummary): number =>
	ANSWER_KEYS.reduce((sum, key) => sum + summary.answers[key], 0);

export function latestApplied(
	approvals: readonly SyncApprovalDetail[],
	group: SyncChangeGroupEnum,
): SyncApprovalDetail | null {
	const applied = approvals.filter(
		(item) =>
			item.group === group &&
			item.action === "apply" &&
			item.outcome === "applied",
	);
	return applied.reduce<SyncApprovalDetail | null>(
		(latest, item) =>
			latest === null || item.created_at > latest.created_at ? item : latest,
		null,
	);
}

export interface TitleDiff {
	prefix: string;
	changed: string;
	suffix: string;
}

export function titleDiff(base: string, other: string): TitleDiff {
	let start = 0;
	while (
		start < base.length &&
		start < other.length &&
		base[start] === other[start]
	) {
		start += 1;
	}
	let end = 0;
	while (
		end < base.length - start &&
		end < other.length - start &&
		base[base.length - 1 - end] === other[other.length - 1 - end]
	) {
		end += 1;
	}
	return {
		prefix: other.slice(0, start),
		changed: other.slice(start, other.length - end),
		suffix: other.slice(other.length - end),
	};
}

export const sameDay = (iso: string, now: Date = new Date()): boolean =>
	new Date(iso).toDateString() === now.toDateString();

const MOVES_RATINGS_KINDS: ReadonlySet<string> = new Set([
	"merge_courses",
	"move_offering",
	"relink_course",
	"place_offering",
]);

export function kindRisk(kind: string): Risk {
	if (MOVES_RATINGS_KINDS.has(kind)) {
		return "moves_ratings";
	}
	if (kind.startsWith("link_") || kind.startsWith("removed_")) {
		return "invisible";
	}
	return "visible";
}
