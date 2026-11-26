import { describe, expect, it } from "vitest";

import { emptySummary, summary } from "./components/dataTestData";
import { previewFixture } from "./components/syncActionsTestData";
import { decisionCounts } from "./components/syncActionsTestData";
import { formatCount } from "./syncFormat";
import { batchDoneText, inboxSteps, previewLines } from "./syncSteps";

describe("inboxSteps", () => {
	it("lists steps in apply order and splits changes by ratings", () => {
		// Arrange & Act
		const steps = inboxSteps(summary);

		// Assert
		expect(steps.map((item) => [item.step, item.count])).toEqual([
			["links", 301],
			["new", 812],
			["changes", 146],
			["changes_rated", 4],
			["questions", 18],
			["removed", 3],
		]);
	});

	it("puts changes no student sees into their own step", () => {
		// Arrange
		const withQuiet = {
			...summary,
			steps: [
				...summary.steps,
				{ ...summary.steps[2]!, step: "quiet_changes", count: 2954, rated: 0 },
			],
		};

		// Act
		const steps = inboxSteps(withQuiet);

		// Assert
		expect(steps.map((item) => item.step)).toContain("changes_quiet");
		expect(steps.find((item) => item.step === "changes_quiet")?.count).toBe(
			2954,
		);
	});

	it("says rated links wait because of their ratings", () => {
		// Arrange
		const rated = {
			...summary,
			steps: summary.steps.map((item) =>
				item.step === "exact_links" ? { ...item, rated: item.count } : item,
			),
		};

		// Act
		const links = inboxSteps(rated).find((item) => item.step === "links");

		// Assert
		expect(links?.text).toContain(
			"Чекають на вас, бо на всіх цих сторінках є оцінки.",
		);
	});

	it("says how many questions have ratings", () => {
		// Arrange & Act
		const questions = inboxSteps(summary).find(
			(item) => item.step === "questions",
		);

		// Assert
		expect(questions?.text).toBe(
			"3 з оцінками, 15 без оцінок. Відповіді поки в консолі.",
		);
	});

	it("counts a question with only study plans as without ratings", () => {
		// Arrange
		const plansOnly = {
			...summary,
			steps: summary.steps.map((item) =>
				item.step === "rated_questions" ? { ...item, count: 4 } : item,
			),
		};

		// Act
		const questions = inboxSteps(plansOnly).find(
			(item) => item.step === "questions",
		);

		// Assert
		expect(questions?.text).toBe(
			"3 з оцінками, 16 без оцінок. Відповіді поки в консолі.",
		);
	});

	it("names what is new by kind", () => {
		// Arrange & Act
		const fresh = inboxSteps(summary).find((item) => item.step === "new");

		// Assert
		expect(fresh?.text).toBe(
			`Семестри дисциплін ${formatCount(772)}, дисципліни 40.`,
		);
	});

	it("hides steps with nothing waiting", () => {
		expect(inboxSteps(emptySummary)).toEqual([]);
	});
});

describe("previewLines", () => {
	it("says what applies and why the rest waits", () => {
		// Arrange
		const preview = previewFixture({
			counts: decisionCounts({ applied: 503, waiting: 360, total: 863 }),
			waiting_reasons: [
				{ code: "waiting_on", text: "чекає на інші зміни", count: 360 },
			],
		});

		// Act
		const lines = previewLines(preview);

		// Assert
		expect(lines.main).toBe("Застосується 503 зміни.");
		expect(lines.notes).toEqual([
			"360 чекають на інші зміни, яких ще немає на сайті. Застосуйте спершу кроки вище.",
		]);
	});

	it("names what the 5 000 cap leaves for later", () => {
		// Arrange
		const preview = previewFixture({
			counts: decisionCounts({ applied: 5000, total: 5000, remaining: 24_457 }),
		});

		// Act
		const lines = previewLines(preview);

		// Assert
		expect(lines.main).toBe(`Застосується ${formatCount(5000)} змін.`);
		expect(lines.notes).toEqual([
			`Ще ${formatCount(24_457)} піде наступними частинами по 5 000, сайт зробить це сам.`,
		]);
	});
});

describe("batchDoneText", () => {
	it("sums every part and says when the rest waits", () => {
		expect(batchDoneText({ applied: 10_000, parts: 2 }, true)).toBe(
			`Застосовано ${formatCount(10_000)} змін за 2 частини. Ви зупинили, решта чекає на сторінці кроку.`,
		);
	});
});
