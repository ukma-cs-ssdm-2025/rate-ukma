import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import {
	journalAnswer,
	journalApply,
	journalAuto,
	journalPolicy,
	journalRejected,
	journalRevert,
	revertDryRun,
} from "./components/syncActionsTestData";
import {
	actionFailure,
	journalApplySummary,
	journalEntryNumber,
	journalNote,
	journalTitle,
	REVERT_CHECK_LOST_TEXT,
	revertFailureText,
	revertSummary,
} from "./syncActions";
import { formatCount } from "./syncFormat";
import { ANSWER_LABELS } from "./syncLabels";

const axiosError = (status: number | null, data?: unknown) => {
	const error = new AxiosError("test");
	if (status !== null) {
		Object.assign(error, { response: { status, data } });
	}
	return error;
};

describe("actionFailure", () => {
	it("treats a 504, a 502 and a network error as a lost answer", () => {
		for (const error of [
			axiosError(504),
			axiosError(502),
			new AxiosError("Network Error"),
		]) {
			const failure = actionFailure(error);
			expect(failure.kind).toBe("lost");
			expect(failure.text).toContain("Відповідь не прийшла.");
			expect(failure.journal).toBe(true);
		}
	});

	it("reads a refusal code from the response", () => {
		const failure = actionFailure(
			axiosError(409, {
				code: "selection_changed",
				detail: "server text",
				status: 409,
				decision_id: null,
			}),
		);
		expect(failure.kind).toBe("refused");
		expect(failure.text).toBe("Список змінився. Перегляньте ще раз.");
		expect(failure.retry).toBe(true);
	});

	it("keeps an unknown refusal's server detail", () => {
		const failure = actionFailure(
			axiosError(400, { detail: "Поганий запит", status: 400 }),
		);
		expect(failure.kind).toBe("error");
		expect(failure.text).toBe("Поганий запит");
	});
});

describe("journal words", () => {
	it("names an apply with its group and author", () => {
		expect(journalTitle(journalApply)).toBe(
			`Оновлено на сайті: ${formatCount(1855)} записів`,
		);
		expect(journalEntryNumber(journalApply)).toBe("рішення #74");
		expect(journalApplySummary(journalApply)).toBe(
			`Оновлено на сайті: ${formatCount(1855)} записів`,
		);
	});

	it("says what an apply left for later", () => {
		expect(
			journalNote({
				...journalApply,
				counts: { applied: 5000, remaining: 24_457, waiting: 12 },
			}),
		).toBe(
			`Ще ${formatCount(24_457)} у наступних частинах, 12 чекають на інші зміни.`,
		);
		expect(journalNote(journalApply)).toBe("");
	});

	it("marks an automatic apply in words", () => {
		expect(journalTitle(journalAuto)).toContain("(автоматично)");
		expect(journalEntryNumber(journalAuto)).toBe("рішення #73");
	});

	it("names a rejection and a revert", () => {
		expect(journalTitle(journalRejected)).toBe(
			"Відкладено нові записи: 3 записи",
		);
		expect(journalTitle(journalRevert)).toBe(
			`Відкочено рішення #74: ${formatCount(1855)} записів повернуто`,
		);
	});

	it("names a policy change and a mapping answer", () => {
		expect(journalTitle(journalPolicy)).toBe(
			"Правило: Звʼязок дисципліни → Авто",
		);
		expect(journalTitle(journalAnswer)).toBe(
			`Відповідь: Обʼєднання дисциплін, ${ANSWER_LABELS.merge}`,
		);
		expect(journalEntryNumber(journalPolicy)).toBe("—");
	});
});

describe("revert words", () => {
	it("says how many changes come back", () => {
		expect(revertSummary(revertDryRun)).toBe(
			`Повернеться ${formatCount(1855)}: поля отримають попередні значення. Нічого не видаляється.`,
		);
	});

	it("names a missing decision", () => {
		expect(
			revertFailureText(axiosError(404, { detail: "Not found" }), false),
		).toBe("Рішення не знайдено.");
	});

	it("says a lost check changed nothing, but a lost write needs the Журнал", () => {
		const lost = new AxiosError("Network Error");
		expect(revertFailureText(lost, false)).toBe(REVERT_CHECK_LOST_TEXT);
		expect(revertFailureText(lost, true)).toBe(actionFailure(lost).text);
		expect(revertFailureText(lost, true)).not.toBe(REVERT_CHECK_LOST_TEXT);
	});

	it("keeps the blocker detail of a refused revert", () => {
		expect(
			revertFailureText(
				axiosError(409, {
					code: "revert_blocked",
					detail: "Не можна відкотити рішення #74: 2 зміни заважають.",
				}),
				true,
			),
		).toBe("Не можна відкотити рішення #74: 2 зміни заважають.");
	});
});
