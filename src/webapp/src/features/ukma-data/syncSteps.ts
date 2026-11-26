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
	"changes_quiet",
	"questions",
	"removed",
] as const;

export type ReviewStep = (typeof REVIEW_STEPS)[number];

export interface ReviewSlice {
	group: SyncSelectionGroupEnum;
	rated: boolean | null;
	match: MatchEnum | null;
	quiet: boolean | null;
}

interface StepCopy {
	title: string;
	hint: string;
	column: string;
	slice: ReviewSlice;
	decidable: boolean;
}

const slice = (
	group: SyncSelectionGroupEnum,
	extra: Partial<Omit<ReviewSlice, "group">> = {},
): ReviewSlice => ({
	group,
	rated: null,
	match: null,
	quiet: null,
	...extra,
});

export const STEP_COPY = {
	links: {
		title: "Звʼязки без змін на сайті",
		hint: "Записи отримають id з САЗ. Студенти нічого не помітять.",
		column: "Що це",
		slice: slice("link", { match: "exact" }),
		decidable: true,
	},
	links_check: {
		title: "Звʼязки, які варто перевірити",
		hint: "Назва на сайті й у САЗ різна, перевірте, що це та сама дисципліна.",
		column: "Назва на сайті й у САЗ",
		slice: slice("link", { match: "review" }),
		decidable: true,
	},
	new: {
		title: "Нові записи",
		hint: "Зʼявляться на сайті: нові семестри, дисципліни, кафедри.",
		column: "Що зʼявиться",
		slice: slice("new"),
		decidable: true,
	},
	changes: {
		title: "Зміни на сторінках без оцінок",
		hint: "Студенти побачать нові значення там, де ще ніхто не оцінював.",
		column: "Що зміниться",
		slice: slice("change", { rated: false, quiet: false }),
		decidable: true,
	},
	changes_rated: {
		title: "Зміни на сторінках з оцінками",
		hint: "Студенти це помітять. Перевірте незвичні значення.",
		column: "Що зміниться",
		slice: slice("change", { rated: true, quiet: false }),
		decidable: true,
	},
	changes_quiet: {
		title: "Зміни, яких студенти не побачать",
		hint: "Змінився лише стан дисципліни: викладається вона чи вже завершена. На сайті цього не видно.",
		column: "Що зміниться",
		slice: slice("change", { quiet: true }),
		decidable: true,
	},
	questions: {
		title: "Питання",
		hint: "Чи це одна дисципліна, куди належить семестр. Відповіді поки в консолі.",
		column: "Питання",
		slice: slice("mapping"),
		decidable: false,
	},
	removed: {
		title: "Зникли з САЗ",
		hint: "Сайт їх не видаляє, лише повідомляє.",
		column: "Що зникло",
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
	const asked = stepOf(summary, "rated_questions");
	const rated = asked?.rated ?? 0;
	const other =
		countOf(summary, "other_questions") + (asked?.count ?? 0) - rated;
	if (rated === 0) {
		return `Усі ${formatCount(other)} без оцінок. Відповіді поки в консолі.`;
	}
	return `${countWith(rated, QUESTIONS_RATED)}, ${formatCount(other)} без оцінок. Відповіді поки в консолі.`;
}

function linksText(summary: SyncSummary): string {
	const links = stepOf(summary, "exact_links");
	const rated = links?.rated ?? 0;
	if (rated === 0) {
		return STEP_COPY.links.hint;
	}
	const why =
		rated === links?.count
			? "Чекають на вас, бо на всіх цих сторінках є оцінки."
			: `Чекають на вас, бо на ${formatCount(rated)} з них є оцінки.`;
	return `${STEP_COPY.links.hint} ${why}`;
}

function stepText(summary: SyncSummary, step: ReviewStep): string {
	switch (step) {
		case "links":
			return linksText(summary);
		case "new":
			return newText(summary);
		case "questions":
			return questionsText(summary);
		default:
			return STEP_COPY[step].hint;
	}
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
		changes_quiet: countOf(summary, "quiet_changes"),
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
						text: stepText(summary, step),
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
			`Ще ${formatCount(counts.remaining)} піде наступними частинами по 5 000, сайт зробить це сам.`,
		);
	}
	return { main, notes };
}

const PARTS = { one: "частину", few: "частини", many: "частин" };

export function batchDoneText(
	progress: Readonly<{ applied: number; parts: number }>,
	stopped: boolean,
): string {
	const head = `Застосовано ${countWith(progress.applied, CHANGES_ACCUSATIVE)} за ${countWith(progress.parts, PARTS)}.`;
	return stopped ? `${head} Ви зупинили, решта чекає на сторінці кроку.` : head;
}
