import axios from "axios";

import { SyncPolicyModeEnum, SyncRefusalCodeEnum } from "@/lib/api/generated";
import type {
	SyncDecisionCounts,
	SyncJournalEntry,
	SyncJournalKindEnum,
	SyncPreviewResponse,
} from "@/lib/api/generated";
import { errorStatus } from "./ukmaDataErrors";
import { kindLabel, numberAt, readPath } from "./sync";
import { CHANGES_ACCUSATIVE, countWith, formatCount } from "./syncFormat";
import { ANSWER_LABELS } from "./syncLabels";
import { GROUP_ORDER, kindParts } from "./syncOverview";
import { TERMS } from "./syncTerms";

const APPLY_CAP = 5000;

const LOST_ANSWER_TEXT =
	"Відповідь не прийшла. Перевірте Журнал, перш ніж повторювати.";

export const GROUP_ROW_TEXT = {
	new: "На сайті з'явиться новий запис",
	link: "Запис отримає id з САЗ, на сайті нічого не видно",
	change: "Поле запису на сайті зміниться (назва, кафедра, кредити)",
	mapping: "Відповісти: catalog_sync answer (у консолі)",
	removed: "Нічого не записується, лише для відома",
} satisfies Record<(typeof GROUP_ORDER)[number], string>;

export const GROUP_ROW_LABEL = {
	new: "Нові",
	link: "Зв'язати",
	change: "Змінити",
	mapping: "Питання",
	removed: "Зникли з САЗ",
} satisfies Record<(typeof GROUP_ORDER)[number], string>;

const GROUP_TERM_NAMES = [...GROUP_ORDER, "other"] as const;

type GroupTermName = (typeof GROUP_TERM_NAMES)[number];

const isGroupTermName = (value: string): value is GroupTermName =>
	GROUP_TERM_NAMES.some((name) => name === value);

const groupName = (group: string): string =>
	isGroupTermName(group)
		? group === "other"
			? TERMS.other.label
			: GROUP_ROW_LABEL[group]
		: group;

const REFUSAL_TEXT = {
	selection_changed: "Список змінився. Перегляньте ще раз.",
	lock_held: "Зараз іде нічне читання САЗ. Спробуйте за кілька хвилин.",
	run_not_current:
		"Ці зміни з попереднього читання САЗ. Відкрийте «Чекають рішення» ще раз.",
	run_too_old:
		"Дані САЗ старші за 48 годин. Перегляньте ще раз після наступного читання.",
	deadline_exceeded:
		"Не встигли за 40 с, нічого не записано. Виберіть менше змін.",
	no_proposed_changes: "Серед вибраних немає змін, що чекають рішення.",
	failed: "Не вдалося виконати дію. Перевірте Журнал.",
	in_progress:
		"Рішення ще виконується. Перевірте Журнал, перш ніж повторювати.",
} satisfies Record<SyncRefusalCodeEnum, string>;

const isRefusalCode = (value: string): value is SyncRefusalCodeEnum =>
	value in SyncRefusalCodeEnum;

const isOverCap = (counts: SyncDecisionCounts): boolean => counts.remaining > 0;

export function applyLabel(counts: SyncDecisionCounts): string {
	if (isOverCap(counts)) {
		return `Застосувати перші ${formatCount(APPLY_CAP)} з ${formatCount(counts.total)}`;
	}
	return `Застосувати ${countWith(counts.applied, CHANGES_ACCUSATIVE)}`;
}

export const rejectLabel = (counts: SyncDecisionCounts): string =>
	`Відхилити ${countWith(counts.total, CHANGES_ACCUSATIVE)}`;

export const applyProgress = (counts: SyncDecisionCounts): string =>
	`Застосовую ${countWith(counts.applied, CHANGES_ACCUSATIVE)}…`;

export const rejectProgress = (counts: SyncDecisionCounts): string =>
	`Відхиляю ${countWith(counts.total, CHANGES_ACCUSATIVE)}…`;

export const rejectConfirm = (counts: SyncDecisionCounts) => ({
	title: `Відхилити ${countWith(counts.total, CHANGES_ACCUSATIVE)}?`,
	description:
		"На сайті нічого не зміниться. Вони повернуться після наступного читання, якщо САЗ не зміниться.",
});

export interface PreviewSummary {
	applied: string;
	leftOut: string;
}

export function previewSummary(counts: SyncDecisionCounts): PreviewSummary {
	const byKind = Object.fromEntries(
		counts.by_kind.map((item) => [item.kind, item.count]),
	);
	const parts = kindParts(byKind);
	const applied =
		counts.applied === 0
			? "Нічого не застосується."
			: `Застосується ${formatCount(counts.applied)}${parts.length > 0 ? `: ${parts}` : ""}.`;
	return {
		applied,
		leftOut: `Не увійде ${formatCount(counts.waiting + counts.skipped)}.`,
	};
}

export function previewReasons(preview: SyncPreviewResponse): string[] {
	return [...preview.waiting_reasons, ...preview.skipped_reasons].map(
		(reason) => `${reason.text} — ${formatCount(reason.count)}`,
	);
}

export interface ActionFailure {
	kind: "refused" | "lost" | "error";
	code: SyncRefusalCodeEnum | null;
	text: string;
	retry: boolean;
	journal: boolean;
}

interface ErrorBody {
	readonly code?: unknown;
	readonly detail?: unknown;
}

const LOST_STATUSES = new Set([502, 504]);

function errorBody(error: unknown): ErrorBody | null {
	if (!axios.isAxiosError<ErrorBody>(error)) {
		return null;
	}
	const data = error.response?.data;
	return typeof data === "object" && data !== null ? data : null;
}

function detailText(body: ErrorBody | null): string | null {
	return typeof body?.detail === "string" && body.detail.length > 0
		? body.detail
		: null;
}

export function actionFailure(error: unknown): ActionFailure {
	if (axios.isAxiosError(error)) {
		const status = error.response?.status;
		if (
			error.code === "ECONNABORTED" ||
			status === undefined ||
			LOST_STATUSES.has(status)
		) {
			return {
				kind: "lost",
				code: null,
				text: LOST_ANSWER_TEXT,
				retry: false,
				journal: true,
			};
		}
		const body = errorBody(error);
		const code = body?.code;
		if (typeof code === "string" && isRefusalCode(code)) {
			return {
				kind: "refused",
				code,
				text: REFUSAL_TEXT[code],
				retry: code === "selection_changed",
				journal: code === "failed" || code === "in_progress",
			};
		}
		return {
			kind: "error",
			code: null,
			text: detailText(body) ?? "Не вдалося виконати дію. Спробуйте ще.",
			retry: true,
			journal: false,
		};
	}
	return {
		kind: "error",
		code: null,
		text: "Не вдалося виконати дію. Спробуйте ще.",
		retry: true,
		journal: false,
	};
}

export function previewLoadText(error: unknown): string {
	const failure = actionFailure(error);
	return failure.kind === "refused" ? failure.text : "Не вдалося завантажити.";
}

const MODE_LABELS = {
	auto: TERMS.auto.label,
	needs_approval: TERMS.needs_approval.label,
} satisfies Record<SyncPolicyModeEnum, string>;

const isMode = (value: string): value is SyncPolicyModeEnum =>
	value in SyncPolicyModeEnum;

const modeName = (value: string | null): string =>
	value !== null && isMode(value) ? MODE_LABELS[value] : (value ?? "—");

const countAt = (raw: unknown, key: string): number => numberAt(raw, key) ?? 0;

const textAt = (raw: unknown, key: string): string | null => {
	const value = readPath(raw, key);
	return typeof value === "string" && value.length > 0 ? value : null;
};

const isAnswer = (value: string): value is keyof typeof ANSWER_LABELS =>
	value in ANSWER_LABELS;

const groupSuffix = (group: string | null): string =>
	group === null ? "" : ` (${groupName(group)})`;

const autoSuffix = (entry: SyncJournalEntry): string =>
	entry.who === null ? " (автоматично)" : "";

const JOURNAL_TITLES = {
	apply: (entry) =>
		`Застосовано ${formatCount(countAt(entry.counts, "applied"))}${groupSuffix(entry.group)}${autoSuffix(entry)}`,
	reject: (entry) =>
		`Відхилено ${formatCount(countAt(entry.counts, "rejected"))}${groupSuffix(entry.group)}${autoSuffix(entry)}`,
	revert: (entry) => {
		const source = entry.reverts_id === null ? "" : ` #${entry.reverts_id}`;
		return `Відкочено${source} (${formatCount(countAt(entry.counts, "reverted"))})${autoSuffix(entry)}`;
	},
	policy: (entry) =>
		`Правило: ${kindLabel(textAt(entry.counts, "kind") ?? "—")} → ${modeName(textAt(entry.counts, "new_mode"))}`,
	answer: (entry) => {
		const answer = textAt(entry.counts, "answer");
		const head = `Відповідь: ${kindLabel(textAt(entry.counts, "kind") ?? "—")}`;
		return answer !== null && isAnswer(answer)
			? `${head} — ${ANSWER_LABELS[answer]}`
			: head;
	},
} satisfies Record<SyncJournalKindEnum, (entry: SyncJournalEntry) => string>;

export const journalTitle = (entry: SyncJournalEntry): string =>
	JOURNAL_TITLES[entry.kind](entry);

export function journalApplySummary(entry: SyncJournalEntry): string {
	return `Застосовано ${countWith(countAt(entry.counts, "applied"), CHANGES_ACCUSATIVE)}${groupSuffix(entry.group)}`;
}

export const journalEntryNumber = (entry: SyncJournalEntry): string =>
	entry.approval_id === null ? "—" : `рішення #${entry.approval_id}`;

export const revertSummary = (result: Readonly<{ reverted: number }>): string =>
	`Повернеться ${formatCount(result.reverted)}: поля отримають попередні значення. Нічого не видаляється.`;

export function revertFailureText(error: unknown): string {
	if (errorStatus(error) === 404) {
		return "Рішення не знайдено.";
	}
	return actionFailure(error).text;
}
