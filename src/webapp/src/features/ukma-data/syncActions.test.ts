import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import {
	decisionCounts,
	journalAnswer,
	journalApply,
	journalAuto,
	journalPolicy,
	journalRejected,
	journalRevert,
	linkCounts,
	overCapCounts,
	revertDryRun,
} from "./components/syncActionsTestData";
import {
	actionFailure,
	applyLabel,
	applyProgress,
	journalApplySummary,
	journalEntryNumber,
	journalTitle,
	previewSummary,
	rejectConfirm,
	rejectLabel,
	REVERT_CHECK_LOST_TEXT,
	revertFailureText,
	revertSummary,
} from "./syncActions";
import { formatCount } from "./syncFormat";
import { ANSWER_LABELS } from "./syncLabels";
import { kindParts } from "./syncOverview";

const axiosError = (status: number | null, data?: unknown) => {
	const error = new AxiosError("test");
	if (status !== null) {
		Object.assign(error, { response: { status, data } });
	}
	return error;
};

describe("apply and reject words", () => {
	it("applies a selection under the cap", () => {
		expect(applyLabel(linkCounts)).toBe(
			`Застосувати ${formatCount(1532)} зміни`,
		);
	});

	it("offers the first 5 000 of a bigger selection", () => {
		expect(applyLabel(overCapCounts)).toBe(
			`Застосувати перші ${formatCount(5000)} з ${formatCount(24_290)}`,
		);
	});

	it("rejects the whole selection", () => {
		expect(rejectLabel(overCapCounts)).toBe(
			`Відхилити ${formatCount(24_290)} змін`,
		);
	});

	it("shows what is running", () => {
		expect(applyProgress(linkCounts)).toBe(
			`Застосовую ${formatCount(1532)} зміни…`,
		);
		expect(applyProgress(overCapCounts)).toBe(
			`Застосовую ${formatCount(5000)} змін…`,
		);
	});

	it("asks before rejecting, naming the count", () => {
		const confirm = rejectConfirm(linkCounts);
		expect(confirm.title).toBe(`Відхилити ${formatCount(1532)} зміни?`);
		expect(confirm.description).toContain("На сайті нічого не зміниться.");
	});
});

describe("previewSummary", () => {
	it("names what applies per kind and what stays behind", () => {
		const summary = previewSummary(linkCounts);
		const parts = kindParts(
			Object.fromEntries(
				linkCounts.by_kind.map((item) => [item.kind, item.count]),
			),
		);
		expect(summary.applied).toBe(
			`Застосується ${formatCount(1532)}: ${parts}.`,
		);
		expect(summary.leftOut).toBe("Не увійде 0.");
	});

	it("says nothing applies when the dry run writes nothing", () => {
		const summary = previewSummary(
			decisionCounts({ waiting: 213, total: 213 }),
		);
		expect(summary.applied).toBe("Нічого не застосується.");
		expect(summary.leftOut).toBe(`Не увійде ${formatCount(213)}.`);
	});

	it("names the changes past the cap", () => {
		expect(previewSummary(overCapCounts).leftOut).toBe(
			`Не увійде 0. Ще ${formatCount(19_290)} — наступного разу.`,
		);
	});
});

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
			`Застосовано ${formatCount(1855)} (Змінити)`,
		);
		expect(journalEntryNumber(journalApply)).toBe("рішення #74");
		expect(journalApplySummary(journalApply)).toBe(
			`Застосовано ${formatCount(1855)} змін (Змінити)`,
		);
	});

	it("marks an automatic apply in words", () => {
		expect(journalTitle(journalAuto)).toContain("(автоматично)");
		expect(journalEntryNumber(journalAuto)).toBe("рішення #73");
	});

	it("names a rejection and a revert", () => {
		expect(journalTitle(journalRejected)).toBe(
			`Відхилено ${formatCount(3)} (Нові)`,
		);
		expect(journalTitle(journalRevert)).toBe(
			`Відкочено #74 (${formatCount(1855)})`,
		);
	});

	it("names a policy change and a mapping answer", () => {
		expect(journalTitle(journalPolicy)).toBe("Правило: Звʼязок курсу → Авто");
		expect(journalTitle(journalAnswer)).toBe(
			`Відповідь: Обʼєднання курсів — ${ANSWER_LABELS.merge}`,
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
