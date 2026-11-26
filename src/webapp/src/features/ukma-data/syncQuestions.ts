import type { AnswerEnum, SyncQuestion } from "@/lib/api/generated";
import { kindLabel } from "./sync";
import { countWith, RATINGS } from "./syncFormat";
import { termWord } from "./syncLabels";

type QuestionCourse = SyncQuestion["courses"][number];

export interface QuestionChoice {
	answer: AnswerEnum;
	label: string;
	into: string | null;
}

export const ANSWER_WORDS = {
	merge: "обʼєднати",
	keep_apart: "лишити окремо",
	keep: "лишити як є",
	move: "перенести",
	place: "прикріпити",
	relink: "перепривʼязати",
} satisfies Record<AnswerEnum, string>;

const APPLY_LATER = new Set<AnswerEnum>(["merge", "move", "place", "relink"]);

export function questionTitle(kind: string): string {
	switch (kind) {
		case "merge_courses":
			return "Це одна дисципліна?";
		case "move_offering":
			return "Перенести семестр на іншу сторінку?";
		case "relink_course":
			return "Звʼязати сторінку з іншим курсом САЗ?";
		case "place_offering":
			return "До якої сторінки належить семестр?";
		default:
			return kindLabel(kind);
	}
}

export function courseChoice(
	question: SyncQuestion,
	course: QuestionCourse,
): QuestionChoice | null {
	switch (question.kind) {
		case "merge_courses":
			return { answer: "merge", label: "Лишити цю", into: course.id };
		case "place_offering":
			return { answer: "place", label: "Сюди", into: course.id };
		default:
			return null;
	}
}

export function questionChoices(question: SyncQuestion): QuestionChoice[] {
	switch (question.kind) {
		case "merge_courses":
			return [
				{ answer: "keep_apart", label: "Це різні дисципліни", into: null },
			];
		case "move_offering":
			return [
				{ answer: "move", label: "Перенести", into: null },
				{ answer: "keep", label: "Залишити, де є", into: null },
			];
		case "relink_course":
			return [
				{ answer: "relink", label: "Перепривʼязати", into: null },
				{ answer: "keep", label: "Залишити", into: null },
			];
		default:
			return [];
	}
}

export function choiceTitle(
	question: SyncQuestion,
	choice: QuestionChoice,
): string {
	const title =
		question.courses.find((course) => course.id === choice.into)?.title ?? "";
	switch (choice.answer) {
		case "merge":
			return `Обʼєднати в «${title}»?`;
		case "place":
			return `Прикріпити семестр до «${title}»?`;
		case "keep_apart":
			return "Лишити дисципліни окремо?";
		case "move":
			return "Перенести семестр?";
		case "relink":
			return "Перепривʼязати сторінку?";
		case "keep":
			return "Залишити як є?";
	}
}

export function answerPreview(detail: string, ratings: number): string {
	const rated =
		ratings === 0
			? "Оцінок це не зачіпає."
			: `Це зачіпає ${countWith(ratings, RATINGS)}.`;
	return `${rated} ${detail}`;
}

export const waitsForApply = (answer: AnswerEnum): boolean =>
	APPLY_LATER.has(answer);

export function answeredText(question: SyncQuestion): string | null {
	if (question.answer === null) {
		return null;
	}
	const words = ANSWER_WORDS[question.answer.answer];
	const target = question.courses.find(
		(course) => course.id === question.answer?.into,
	);
	const into = target === undefined ? "" : ` у «${target.title}»`;
	return waitsForApply(question.answer.answer)
		? `Відповідь: ${words}${into}. Чекає застосування внизу.`
		: `Відповідь: ${words}. Питання закрите.`;
}

export function offeringText(offering: SyncQuestion["offering"]): string {
	if (offering === null || offering === undefined) {
		return "";
	}
	const term = termWord(offering.term);
	return term === null
		? `, ${offering.year}`
		: `, ${term.toLowerCase()} ${offering.year}`;
}

export function pendingApplyIds(questions: readonly SyncQuestion[]): number[] {
	return questions.flatMap((question) =>
		question.answer !== null && waitsForApply(question.answer.answer)
			? [question.id]
			: [],
	);
}
