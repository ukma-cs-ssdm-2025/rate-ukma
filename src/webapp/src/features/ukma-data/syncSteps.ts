import type {
	MatchEnum,
	SyncPreviewResponse,
	SyncSelectionGroupEnum,
	SyncSummary,
} from "@/lib/api/generated";
import { CHANGES_ACCUSATIVE, countWith, formatCount } from "./syncFormat";
import { kindParts } from "./syncOverview";

export const REVIEW_STEPS = [
	"links",
	"links_check",
	"new",
	"changes",
	"changes_rated",
	"questions",
	"removed",
] as const;

export type ReviewStep = (typeof REVIEW_STEPS)[number];

export interface ReviewSlice {
	group: SyncSelectionGroupEnum;
	rated: boolean | null;
	match: MatchEnum | null;
}

interface StepCopy {
	title: string;
	hint: string;
	slice: ReviewSlice;
	decidable: boolean;
}

const slice = (
	group: SyncSelectionGroupEnum,
	extra: Partial<Omit<ReviewSlice, "group">> = {},
): ReviewSlice => ({ group, rated: null, match: null, ...extra });

export const STEP_COPY = {
	links: {
		title: "Звʼязки без змін на сайті",
		hint: "Записи отримають id з САЗ. Студенти нічого не помітять.",
		slice: slice("link", { match: "exact" }),
		decidable: true,
	},
	links_check: {
		title: "Звʼязки, які варто перевірити",
		hint: "Назва на сайті й у САЗ різна, перевірте, що це та сама дисципліна.",
		slice: slice("link", { match: "review" }),
		decidable: true,
	},
	new: {
		title: "Нові записи",
		hint: "Зʼявляться на сайті: нові семестри, дисципліни, кафедри.",
		slice: slice("new"),
		decidable: true,
	},
	changes: {
		title: "Зміни на сторінках без оцінок",
		hint: "Назва, кафедра чи кредити зміняться там, де ще ніхто не оцінював.",
		slice: slice("change", { rated: false }),
		decidable: true,
	},
	changes_rated: {
		title: "Зміни на сторінках з оцінками",
		hint: "Студенти це помітять. Перевірте незвичні значення.",
		slice: slice("change", { rated: true }),
		decidable: true,
	},
	questions: {
		title: "Питання",
		hint: "Чи це одна дисципліна, куди належить семестр. Відповіді поки в консолі.",
		slice: slice("mapping"),
		decidable: false,
	},
	removed: {
		title: "Зникли з САЗ",
		hint: "Сайт їх не видаляє, лише повідомляє.",
		slice: slice("removed"),
		decidable: false,
	},
} satisfies Record<ReviewStep, StepCopy>;

export interface InboxStep {
	step: ReviewStep;
	title: string;
	text: string;
	count: number;
}

const QUESTIONS_RATED = {
	one: "з оцінками",
	few: "з оцінками",
	many: "з оцінками",
};

function stepOf(summary: SyncSummary, name: string) {
	return summary.steps.find((step) => step.step === name);
}

function countOf(summary: SyncSummary, name: string): number {
	return stepOf(summary, name)?.count ?? 0;
}

function newText(summary: SyncSummary): string {
	const parts = kindParts(stepOf(summary, "new_rows")?.kinds ?? {});
	return parts.length > 0
		? `${parts[0]?.toUpperCase()}${parts.slice(1)}.`
		: STEP_COPY.new.hint;
}

function questionsText(summary: SyncSummary): string {
	const rated = countOf(summary, "rated_questions");
	const other = countOf(summary, "other_questions");
	if (rated === 0) {
		return `Усі ${formatCount(other)} без оцінок. Відповіді поки в консолі.`;
	}
	return `${countWith(rated, QUESTIONS_RATED)}, ${formatCount(other)} без оцінок. Відповіді поки в консолі.`;
}

export function inboxSteps(summary: SyncSummary): InboxStep[] {
	const changes = stepOf(summary, "field_changes");
	const rated = changes?.rated ?? 0;
	const counts = {
		links: countOf(summary, "exact_links"),
		links_check: countOf(summary, "review_links"),
		new: countOf(summary, "new_rows"),
		changes: (changes?.count ?? 0) - rated,
		changes_rated: rated,
		questions:
			countOf(summary, "rated_questions") + countOf(summary, "other_questions"),
		removed: countOf(summary, "removed"),
	} satisfies Record<ReviewStep, number>;
	return REVIEW_STEPS.flatMap((step) =>
		counts[step] > 0
			? [
					{
						step,
						title: STEP_COPY[step].title,
						text:
							step === "new"
								? newText(summary)
								: step === "questions"
									? questionsText(summary)
									: STEP_COPY[step].hint,
						count: counts[step],
					},
				]
			: [],
	);
}

const WAITING_TEXT =
	"чекають на інші зміни, яких ще немає на сайті. Застосуйте спершу кроки вище";

export interface PreviewLines {
	main: string;
	notes: string[];
}

export function previewLines(preview: SyncPreviewResponse): PreviewLines {
	const { counts } = preview;
	const main =
		counts.applied === 0
			? "Нічого з вибраного зараз не застосується."
			: `Застосується ${countWith(counts.applied, CHANGES_ACCUSATIVE)}.`;
	const notes = [
		...preview.waiting_reasons,
		...preview.skipped_reasons,
	].flatMap((reason) =>
		reason.count > 0
			? [
					`${formatCount(reason.count)} ${reason.code === "waiting_on" ? WAITING_TEXT : reason.text}.`,
				]
			: [],
	);
	if (counts.remaining > 0) {
		notes.push(
			`Ще ${formatCount(counts.remaining)} залишаться на наступний раз: за один раз сайт застосовує до 5 000.`,
		);
	}
	return { main, notes };
}
