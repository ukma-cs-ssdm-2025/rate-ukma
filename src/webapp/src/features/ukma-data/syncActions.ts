import axios from "axios";

import { SyncRefusalCodeEnum } from "@/lib/api/generated";
import type {
	SyncJournalEntry,
	SyncJournalKindEnum,
	SyncPolicyModeEnum,
	SyncRevertResponse,
} from "@/lib/api/generated";
import { DECISION_FAILED_TEXT } from "./caseActions";
import { errorStatus } from "./ukmaDataErrors";
import { kindLabel } from "./sync";
import { CHANGES_ACCUSATIVE, countWith, formatCount } from "./syncFormat";
import { ANSWER_LABELS } from "./syncLabels";
import { GROUP_ORDER } from "./syncOverview";
import { TERMS } from "./syncTerms";

const LOST_ANSWER_TEXT =
	"Відповідь не прийшла. Перевірте Журнал, перш ніж повторювати.";

const GROUP_ROW_LABEL = {
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
	Object.hasOwn(SyncRefusalCodeEnum, value);

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

const MODE_LABELS = {
	auto: TERMS.auto.label,
	needs_approval: TERMS.needs_approval.label,
} satisfies Record<SyncPolicyModeEnum, string>;

const modeName = (value: SyncPolicyModeEnum | null): string =>
	value === null ? "—" : MODE_LABELS[value];

const isAnswer = (value: string): value is keyof typeof ANSWER_LABELS =>
	Object.hasOwn(ANSWER_LABELS, value);

const groupSuffix = (group: string | null): string =>
	group === null ? "" : ` (${groupName(group)})`;

const autoSuffix = (entry: SyncJournalEntry): string =>
	entry.who === null ? " (автоматично)" : "";

const JOURNAL_TITLES = {
	apply: (entry) =>
		`Застосовано ${formatCount(entry.counts.applied ?? 0)}${groupSuffix(entry.group)}${autoSuffix(entry)}`,
	reject: (entry) =>
		`Відхилено ${formatCount(entry.counts.rejected ?? 0)}${groupSuffix(entry.group)}${autoSuffix(entry)}`,
	revert: (entry) => {
		const source = entry.reverts_id === null ? "" : ` #${entry.reverts_id}`;
		return `Відкочено${source} (${formatCount(entry.counts.reverted ?? 0)})${autoSuffix(entry)}`;
	},
	policy: (entry) =>
		`Правило: ${kindLabel(entry.counts.kind ?? "—")} → ${modeName(entry.counts.new_mode ?? null)}`,
	answer: (entry) => {
		const answer = entry.counts.answer;
		const head = `Відповідь: ${kindLabel(entry.counts.kind ?? "—")}`;
		return answer !== undefined && isAnswer(answer)
			? `${head} — ${ANSWER_LABELS[answer]}`
			: head;
	},
	decision: (entry) => decisionTitle(entry),
} satisfies Record<SyncJournalKindEnum, (entry: SyncJournalEntry) => string>;

const DECISION_TITLES = {
	decide_case: "Рішення в UKMA Data: та сама людина",
	merge_course: "Рішення в UKMA Data: об'єднано",
	unmerge_course: "Рішення в UKMA Data: роз'єднано",
} as const;

const DECISION_ERRORS = {
	same_course: "Не можна об'єднати курс сам із собою.",
	course_merged: "Цей курс уже об'єднано з іншим.",
	target_merged: "Курс, з яким об'єднують, уже об'єднано з іншим.",
	level_mismatch: "Курси різного рівня: об'єднати можна лише однакові.",
	not_merged: "Цей курс не об'єднано, тож роз'єднувати нічого.",
	not_student_match: "Це не справа про студента.",
	not_open: "Справу вже закрито або вона неактуальна.",
	not_found: "UKMA Data не знає такої справи або курсу.",
	forbidden: "Ключ UKMA Data цього сервера не має доступу до цього розділу.",
} satisfies Record<string, string>;

const isDecisionError = (
	value: string,
): value is keyof typeof DECISION_ERRORS =>
	Object.hasOwn(DECISION_ERRORS, value);

export function decisionErrorText(
	entry: Pick<SyncJournalEntry, "outcome" | "error">,
): string {
	if (entry.outcome === "failed") {
		return DECISION_FAILED_TEXT;
	}
	return isDecisionError(entry.error)
		? DECISION_ERRORS[entry.error]
		: entry.error;
}

function decisionTitle(entry: SyncJournalEntry): string {
	const action = entry.counts.action;
	const head =
		action === undefined ? "Рішення в UKMA Data" : DECISION_TITLES[action];
	if (entry.outcome === "done") {
		return head;
	}
	return `${head} — ${entry.outcome === "refused" ? "відмова" : "помилка"}`;
}

export const journalTitle = (entry: SyncJournalEntry): string =>
	JOURNAL_TITLES[entry.kind](entry);

export function journalApplySummary(entry: SyncJournalEntry): string {
	return `Застосовано ${countWith(entry.counts.applied ?? 0, CHANGES_ACCUSATIVE)}${groupSuffix(entry.group)}`;
}

export const journalEntryNumber = (entry: SyncJournalEntry): string =>
	entry.approval_id === null ? "—" : `рішення #${entry.approval_id}`;

export const revertSummary = (result: Readonly<{ reverted: number }>): string =>
	`Повернеться ${formatCount(result.reverted)}: поля отримають попередні значення. Нічого не видаляється.`;

export const REVERT_CHECK_LOST_TEXT =
	"Перевірка не відповіла. Нічого не змінилося; спробуйте ще раз.";

export function revertFailureText(error: unknown, writing: boolean): string {
	if (errorStatus(error) === 404) {
		return "Рішення не знайдено.";
	}
	const failure = actionFailure(error);
	return failure.kind === "lost" && !writing
		? REVERT_CHECK_LOST_TEXT
		: failure.text;
}

export function revertRefusal(error: unknown): SyncRevertResponse | null {
	if (!axios.isAxiosError<SyncRevertResponse>(error)) {
		return null;
	}
	const data = error.response?.data;
	if (error.response?.status !== 409 || data === undefined) {
		return null;
	}
	return Array.isArray(data.blockers) ? data : null;
}

export const revertIsRefused = (result: SyncRevertResponse): boolean =>
	result.outcome === "refused" || result.code !== null;
