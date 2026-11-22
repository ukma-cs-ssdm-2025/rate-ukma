import type {
	AnswerEnum,
	SyncQuestion,
	SyncQuestionCourse,
} from "@/lib/api/generated";
import { countWith, formatCount } from "./syncFormat";
import {
	cleanTitle,
	ratingsText,
	SEMESTERS,
	semesterLabel,
	termLabel,
} from "./syncWords";

export interface DeskPair {
	keep: SyncQuestionCourse;
	gone: SyncQuestionCourse[];
}

export function deskPair(
	question: SyncQuestion,
	keepId: string | null,
): DeskPair | null {
	const wanted = keepId ?? question.suggested_into;
	const keep =
		question.courses.find((course) => course.id === wanted) ??
		question.courses[0];
	if (keep === undefined) {
		return null;
	}
	return {
		keep,
		gone: question.courses.filter((course) => course.id !== keep.id),
	};
}

export function mergeAsk(question: SyncQuestion): string {
	const title = cleanTitle(
		question.ukma_title ?? question.courses[0]?.title ?? "",
	);
	const department = question.ukma_department
		? `, ${cleanTitle(question.ukma_department).toLowerCase()}`
		: "";
	const pages =
		question.courses.length > 2 ? "кілька сторінок" : "дві сторінки";
	return `У САЗ це одна дисципліна — «${title}»${department}. На сайті в неї ${pages}. Об'єднати в одну?`;
}

const sameText = (left: string, right: string | null): boolean =>
	right !== null &&
	left.trim().toLowerCase() === cleanTitle(right).trim().toLowerCase();

export function keepReason(
	question: SyncQuestion,
	keep: SyncQuestionCourse,
): string {
	if (keep.id !== question.suggested_into) {
		return "Ви обрали залишити цю сторінку.";
	}
	if (keep.ratings > 0) {
		return "Пропонуємо залишити сторінку з оцінками: студенти знайдуть свої оцінки там, де й були.";
	}
	if (sameText(keep.department, question.ukma_department)) {
		return "Пропонуємо залишити сторінку з кафедрою, як у САЗ.";
	}
	return "Пропонуємо залишити сторінку, яка вже відповідає САЗ.";
}

export function mergeOutcome(pair: DeskPair): string {
	const moved = pair.gone.reduce(
		(sum, course) => sum + course.offerings.length,
		0,
	);
	const ratings = pair.gone.reduce((sum, course) => sum + course.ratings, 0);
	const withRatings = ratings > 0 ? ` разом із ${ratingsText(ratings)}` : "";
	const many = pair.gone.length > 1;
	const from = many ? "з інших сторінок" : "з другої сторінки";
	const verb = moved === 1 ? "перейде" : "перейдуть";
	const pages = many
		? "Інші сторінки зникнуть із сайту; їхні копії лишаться в історії."
		: "Друга сторінка зникне з сайту; її копія лишиться в історії.";
	return `${countWith(moved, SEMESTERS)} ${from} ${verb} на першу${withRatings}. ${pages}`;
}

export interface OfferingChips {
	shown: string[];
	more: number;
}

export function offeringChips(course: SyncQuestionCourse): OfferingChips {
	const shown = course.offerings.slice(-4).map((offering) => {
		const label = semesterLabel(offering.year, offering.term);
		return offering.saz_code ? `${label} · ${offering.saz_code}` : label;
	});
	return { shown, more: Math.max(0, course.offerings.length - 4) };
}

export interface PlaceOption {
	course: SyncQuestionCourse;
	answer: AnswerEnum;
	into: string | null;
}

export function placeOptions(question: SyncQuestion): PlaceOption[] {
	if (question.kind === "move_offering") {
		return question.courses.map((course) =>
			course.id === question.move_into
				? { course, answer: "move", into: null }
				: { course, answer: "keep", into: null },
		);
	}
	return question.courses.map((course) => ({
		course,
		answer: "place",
		into: course.id,
	}));
}

export function placeAsk(question: SyncQuestion): string {
	const title = cleanTitle(
		question.ukma_title ?? question.courses[0]?.title ?? "",
	);
	const offering = question.offering;
	const when =
		offering === null
			? ""
			: ` — ${termLabel(offering.term).toLowerCase()} ${offering.year}${offering.saz_code ? `, код ${offering.saz_code}` : ""}`;
	if (question.kind === "move_offering") {
		return `Семестр «${title}»${when} САЗ відносить до іншої дисципліни. На якій сторінці йому бути?`;
	}
	return `У САЗ є семестр «${title}»${when}. На сайті кілька дисциплін з такою назвою. До якої він належить?`;
}

export const PLACE_OUTCOME =
	"семестр з'явиться на сторінці обраної дисципліни, і студенти зможуть його оцінювати. Інші сторінки не зміняться.";

export function deskProgress(index: number, total: number): number {
	if (total <= 0) {
		return 0;
	}
	return Math.min(100, ((index + 1) / total) * 100);
}

export const progressLabel = (
	index: number,
	total: number,
	suffix: string,
): string =>
	`${formatCount(Math.min(index + 1, total))} з ${formatCount(total)}${suffix}`;

export function nextIndex(index: number, total: number): number {
	return total === 0 ? 0 : (index + 1) % total;
}

export interface Decisions {
	answered: number[];
	skipped: number[];
}

export function decisionCount(decisions: Decisions): number {
	return decisions.answered.length + decisions.skipped.length;
}

export function answeredIds(questions: readonly SyncQuestion[]): number[] {
	return questions.flatMap((question) =>
		question.answer === null ? [] : [question.id],
	);
}

export interface DeskAnswer {
	answer: AnswerEnum | "none";
	into: string | null;
}

export function deskAnswers(
	questions: readonly SyncQuestion[],
	local: ReadonlyMap<number, DeskAnswer>,
): Map<number, DeskAnswer> {
	const answers = new Map<number, DeskAnswer>();
	for (const question of questions) {
		const mine = local.get(question.id);
		if (mine !== undefined) {
			answers.set(question.id, mine);
		} else if (question.answer !== null) {
			answers.set(question.id, {
				answer: question.answer.answer,
				into: question.answer.into,
			});
		}
	}
	return answers;
}

export function idsAnswered(
	answers: ReadonlyMap<number, DeskAnswer>,
	wanted: ReadonlySet<DeskAnswer["answer"]>,
): number[] {
	return [...answers.entries()].flatMap(([id, value]) =>
		wanted.has(value.answer) ? [id] : [],
	);
}

export function firstOpen(
	questions: readonly SyncQuestion[],
	answers: ReadonlyMap<number, DeskAnswer>,
): number {
	const index = questions.findIndex((question) => !answers.has(question.id));
	return index === -1 ? 0 : index;
}

export function chunks<T>(items: readonly T[], size: number): T[][] {
	const result: T[][] = [];
	for (let start = 0; start < items.length; start += size) {
		result.push(items.slice(start, start + size));
	}
	return result;
}

export function matchesQuery(question: SyncQuestion, query: string): boolean {
	const needle = query.trim().toLowerCase();
	if (needle === "") {
		return true;
	}
	return question.courses.some((course) =>
		cleanTitle(course.title).toLowerCase().includes(needle),
	);
}
