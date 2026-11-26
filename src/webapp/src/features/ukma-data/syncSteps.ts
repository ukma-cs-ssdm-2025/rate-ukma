import type {
	MatchEnum,
	SyncPreviewResponse,
	SyncSelectionGroupEnum,
	SyncSummary,
} from "@/lib/api/generated";
import { numberAt, readPath } from "./sync";
import { CHANGES_ACCUSATIVE, countWith, formatCount } from "./syncFormat";
import { studentFieldLabel } from "./syncLabels";
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
	column: string;
	slice: ReviewSlice;
	decidable: boolean;
	preselect: boolean;
}

const slice = (
	group: SyncSelectionGroupEnum,
	extra: Partial<Omit<ReviewSlice, "group">> = {},
): ReviewSlice => ({ group, rated: null, match: null, ...extra });

export const STEP_COPY = {
	links: {
		title: "Звʼязки без змін на сайті",
		hint: "Записи отримають id з САЗ. Назви, кафедри й оцінки на сайті лишаються як є.",
		column: "Що це",
		slice: slice("link", { match: "exact" }),
		decidable: true,
		preselect: false,
	},
	links_check: {
		title: "Звʼязки, які варто перевірити",
		hint: "Назва на сайті й у САЗ різна, перевірте, що це та сама дисципліна.",
		column: "Назва на сайті й у САЗ",
		slice: slice("link", { match: "review" }),
		decidable: true,
		preselect: false,
	},
	new: {
		title: "Нові записи",
		hint: "Зʼявляться на сайті: нові семестри, дисципліни, кафедри.",
		column: "Що зʼявиться",
		slice: slice("new"),
		decidable: true,
		preselect: true,
	},
	changes: {
		title: "Зміни на сторінках без оцінок",
		hint: "Поля дисциплін і семестрів зміняться там, де ще ніхто не оцінював.",
		column: "Що зміниться",
		slice: slice("change", { rated: false }),
		decidable: true,
		preselect: true,
	},
	changes_rated: {
		title: "Зміни на сторінках з оцінками",
		hint: "Студенти це помітять. Перевірте незвичні значення.",
		column: "Що зміниться",
		slice: slice("change", { rated: true }),
		decidable: true,
		preselect: false,
	},
	questions: {
		title: "Питання",
		hint: "Чи це одна дисципліна, куди належить семестр. Відповідайте на картках, а відповіді, що щось переносять, застосуйте внизу.",
		column: "Питання",
		slice: slice("mapping"),
		decidable: false,
		preselect: false,
	},
	removed: {
		title: "Зникли з САЗ",
		hint: "Сайт їх не видаляє, лише повідомляє.",
		column: "Що зникло",
		slice: slice("removed"),
		decidable: false,
		preselect: false,
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
		return `Усі ${formatCount(other)} без оцінок.`;
	}
	return `${countWith(rated, QUESTIONS_RATED)}, ${formatCount(other)} без оцінок.`;
}

const TOP_FIELDS = 3;

function linksText(summary: SyncSummary): string {
	const links = stepOf(summary, "exact_links");
	const rated = links?.rated ?? 0;
	if (rated === 0) {
		return STEP_COPY.links.hint;
	}
	const all = rated === links?.count;
	return `${all ? "Усі" : formatCount(rated)} на сторінках з оцінками, тому не застосовані самі. Назви й оцінки не зміняться.`;
}

export function topFieldsText(
	summary: SyncSummary,
	rated: boolean,
): string | null {
	const fields = readPath(stepOf(summary, "field_changes")?.facets, "fields");
	if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
		return null;
	}
	const counts = Object.keys(fields).flatMap((name) => {
		const label = studentFieldLabel(name);
		const count = numberAt(fields, name, "count") ?? 0;
		const ratedCount = numberAt(fields, name, "rated") ?? 0;
		const shown = rated ? ratedCount : count - ratedCount;
		return label === null || shown === 0 ? [] : [{ label, shown }];
	});
	const top = counts
		.sort((a, b) => b.shown - a.shown)
		.slice(0, TOP_FIELDS)
		.map((item) => `${item.label.toLowerCase()} ${formatCount(item.shown)}`);
	return top.length === 0 ? null : `Найчастіше: ${top.join(", ")}.`;
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
						text: stepText(summary, step),
						count: counts[step],
					},
				]
			: [],
	);
}

function stepText(summary: SyncSummary, step: ReviewStep): string {
	switch (step) {
		case "links":
			return linksText(summary);
		case "new":
			return newText(summary);
		case "questions":
			return questionsText(summary);
		case "changes":
			return topFieldsText(summary, false) ?? STEP_COPY.changes.hint;
		case "changes_rated": {
			const top = topFieldsText(summary, true);
			return top === null
				? STEP_COPY.changes_rated.hint
				: `${STEP_COPY.changes_rated.hint} ${top}`;
		}
		default:
			return STEP_COPY[step].hint;
	}
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
