import { describe, expect, it } from "vitest";

import {
	course,
	mergeQuestion,
	otherCourse,
	placeQuestion,
} from "./components/syncTestData";
import {
	chunks,
	deskAnswers,
	deskPair,
	deskProgress,
	firstOpen,
	idsAnswered,
	keepReason,
	matchesQuery,
	mergeAsk,
	mergeOutcome,
	nextIndex,
	offeringChips,
	placeAsk,
	placeOptions,
	progressLabel,
} from "./syncDesk";
import type { DeskAnswer } from "./syncDesk";

describe("merge desk", () => {
	it("keeps the suggested page and lets the other one stay instead", () => {
		// Arrange
		const question = mergeQuestion();

		// Act
		const suggested = deskPair(question, null);
		const swapped = deskPair(question, otherCourse.id);

		// Assert
		expect(suggested?.keep.id).toBe(course().id);
		expect(suggested?.gone.map((item) => item.id)).toEqual([otherCourse.id]);
		expect(swapped?.keep.id).toBe(otherCourse.id);
		expect(deskPair(mergeQuestion({ courses: [] }), null)).toBeNull();
	});

	it("asks in plain words and explains why the page stays", () => {
		// Arrange
		const question = mergeQuestion();

		// Assert
		expect(mergeAsk(question)).toBe(
			"У САЗ це одна дисципліна — «Основи мережевих протоколів», кафедра мережевих систем. На сайті в неї дві сторінки. Об'єднати в одну?",
		);
		expect(keepReason(question, course())).toMatch(/сторінку з оцінками/);
		expect(keepReason(question, otherCourse)).toBe(
			"Ви обрали залишити цю сторінку.",
		);
	});

	it("says what a merge moves", () => {
		// Arrange
		const pair = deskPair(mergeQuestion(), null);

		// Assert
		expect(pair && mergeOutcome(pair)).toBe(
			"1 семестр з другої сторінки перейде на першу. Друга сторінка зникне з сайту; її копія лишиться в історії.",
		);
	});

	it("shows the last four semesters with their codes", () => {
		// Arrange
		const many = course({
			offerings: Array.from({ length: 6 }, (_, index) => ({
				saz_code: `90010${index}`,
				year: 2020 + index,
				term: "FALL",
				ratings: 0,
			})),
		});

		// Act
		const chips = offeringChips(many);

		// Assert
		expect(chips.shown).toEqual([
			"Осінь 2022 · 900102",
			"Осінь 2023 · 900103",
			"Осінь 2024 · 900104",
			"Осінь 2025 · 900105",
		]);
		expect(chips.more).toBe(2);
	});
});

describe("place desk", () => {
	it("offers each course as a place answer", () => {
		// Act
		const options = placeOptions(placeQuestion());

		// Assert
		expect(options.map((option) => [option.answer, option.into])).toEqual([
			["place", course().id],
			["place", otherCourse.id],
		]);
	});

	it("maps a move question to keep and move", () => {
		// Arrange
		const question = placeQuestion({
			kind: "move_offering",
			move_into: otherCourse.id,
		});

		// Act
		const options = placeOptions(question);

		// Assert
		expect(options.map((option) => option.answer)).toEqual(["keep", "move"]);
		expect(placeAsk(question)).toMatch(/САЗ відносить до іншої дисципліни/);
	});

	it("asks about the semester with its term and code", () => {
		// Assert
		expect(placeAsk(placeQuestion())).toBe(
			"У САЗ є семестр «Бренд-стратегії» — осінь 2019, код 934493. На сайті кілька дисциплін з такою назвою. До якої він належить?",
		);
	});
});

describe("progress and answers", () => {
	it("reports progress and wraps to the start", () => {
		// Assert
		expect(deskProgress(0, 10)).toBe(10);
		expect(deskProgress(0, 0)).toBe(0);
		expect(progressLabel(1, 28, "")).toBe("2 з 28");
		expect(nextIndex(9, 10)).toBe(0);
		expect(nextIndex(0, 0)).toBe(0);
	});

	it("merges saved and local answers and finds the first open question", () => {
		// Arrange
		const saved = mergeQuestion({
			id: 1,
			answer: {
				answer: "keep_apart",
				into: null,
				decided_at: "2030-09-01T00:00:00Z",
			},
		});
		const open = mergeQuestion({ id: 2 });
		const local = new Map<number, DeskAnswer>([
			[3, { answer: "merge", into: course().id }],
		]);

		// Act
		const answers = deskAnswers([saved, open, mergeQuestion({ id: 3 })], local);

		// Assert
		expect(idsAnswered(answers, new Set(["keep_apart"]))).toEqual([1]);
		expect(idsAnswered(answers, new Set(["merge"]))).toEqual([3]);
		expect(firstOpen([saved, open], answers)).toBe(1);
		expect(firstOpen([saved], answers)).toBe(0);
	});

	it("splits ids into chunks and searches titles", () => {
		// Assert
		expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(matchesQuery(mergeQuestion(), "мережев")).toBe(true);
		expect(matchesQuery(mergeQuestion(), "хімія")).toBe(false);
		expect(matchesQuery(mergeQuestion(), " ")).toBe(true);
	});
});
