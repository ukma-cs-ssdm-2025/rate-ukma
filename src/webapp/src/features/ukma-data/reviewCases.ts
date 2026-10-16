import type {
	CaseKind,
	CaseStatus,
	Decision,
	DecisionKind,
	ReviewCase,
} from "./api/schemas";

export const CASE_KIND_LABELS: Record<CaseKind, string> = {
	course_match: "Збіг курсу",
	instructor_match: "Викладач",
	removals_held: "Утримані вилучення",
};

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
	open: "Відкрита",
	decided: "Вирішена",
	obsolete: "Неактуальна",
};

export const SAFE_ANSWER_LABELS: Record<CaseKind, string> = {
	course_match: "окремий курс",
	instructor_match: "без звʼязку з викладачем",
	removals_held: "нічого не вилучено",
};

export const DECISION_LABELS: Record<DecisionKind, string> = {
	merge: "Обʼєднати",
	keep_apart: "Залишити окремо",
	split: "Розділити",
	link_instructor: "Привʼязати викладача",
	keep_unlinked: "Не привʼязувати",
	apply_removals: "Застосувати вилучення",
	drop_removals: "Скасувати вилучення",
};

export const DECISION_EFFECTS: Record<DecisionKind, string> = {
	merge:
		"Пропозиція перейде до наявного курсу, а створений для неї курс буде вилучено з посиланням на наявний. Оцінки залишаться на пропозиції.",
	keep_apart:
		"Курси залишаться окремими, і правила зіставлення більше не питатимуть про цю пару.",
	split:
		"Пропозиція повернеться в окремий курс. Це скасовує попереднє обʼєднання.",
	link_instructor:
		"Викладач зʼявиться на пропозиції в Rate UKMA після наступної синхронізації.",
	keep_unlinked: "Пропозиція залишиться без викладача.",
	apply_removals:
		"Усі пропозиції зі списку отримають removedAt і зникнуть з Rate UKMA.",
	drop_removals:
		"Нічого не буде вилучено. Наступний повний запуск перерахує вилучення знову.",
};

/** Decisions staff can take now: the case's own pair, or a split that reverses a merge. */
export function availableDecisions(
	reviewCase: ReviewCase,
	decision: Decision | undefined,
): DecisionKind[] {
	if (reviewCase.status === "decided") {
		return decision?.kind === "merge" ? ["split"] : [];
	}
	if (reviewCase.status !== "open") return [];
	switch (reviewCase.kind) {
		case "course_match":
			return ["merge", "keep_apart"];
		case "instructor_match":
			return reviewCase.candidates.length > 0
				? ["link_instructor", "keep_unlinked"]
				: ["keep_unlinked"];
		case "removals_held":
			return ["apply_removals", "drop_removals"];
	}
}

export function caseTitle(reviewCase: ReviewCase): string {
	return reviewCase.kind === "removals_held"
		? `Запуск САЗ ${formatAcademicYear(reviewCase.academicYear)}: ${reviewCase.offerings.length} вилучень`
		: reviewCase.subject.title;
}

export function formatAcademicYear(year: number): string {
	return `${year}–${String(year + 1).slice(2)}`;
}

const dateTime = new Intl.DateTimeFormat("uk-UA", {
	dateStyle: "medium",
	timeStyle: "short",
	timeZone: "Europe/Kyiv",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
