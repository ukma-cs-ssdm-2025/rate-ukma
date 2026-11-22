import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type MockAdapter from "axios-mock-adapter";
import { afterEach, describe, expect, it } from "vitest";

import { EXPLAINER_KEY } from "./SyncExplainer";
import {
	appliedApproval,
	catalogSummary,
	emptySummary,
	linksPreview,
	listPage,
	SYNC_URL,
} from "./syncTestData";
import {
	APPROVE_URL,
	bodyOf,
	mockSync,
	PREVIEW_URL,
	renderSync,
	SUMMARY_URL,
} from "./syncTestRender";

let mock: MockAdapter;

afterEach(() => {
	mock.restore();
});

describe("pending overview", () => {
	it("leads with plain group lines and no internal ids", async () => {
		// Arrange
		mock = mockSync();

		// Act
		renderSync();

		// Assert
		const groups = await screen.findByRole("list", { name: "Групи змін" });
		expect(
			screen.getByRole("heading", { name: "Що змінилось у САЗ" }),
		).toBeInTheDocument();
		expect(within(groups).getAllByRole("listitem")).toHaveLength(5);
		expect(groups).toHaveTextContent("ті самі, що в САЗ");
		expect(groups).toHaveTextContent("Може перенести оцінки");
		expect(
			within(groups).getByRole("button", { name: /Підтвердити всі 29\s457/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("tab", { name: /Чекають рішення\s*32\s388/ }),
		).toBeInTheDocument();
		expect(document.body).not.toHaveTextContent(/UKMA Data|crs_|off_/);
		expect(
			screen.getByText(/Ще 1\s234 записи САЗ не потрапили сюди/),
		).toBeInTheDocument();
	});

	it("opens the explainer on the first visit only", async () => {
		// Arrange
		mock = mockSync();

		// Act
		const first = renderSync();

		// Assert
		expect(
			await screen.findByText(
				/Без вашого підтвердження на сайті нічого не змінюється/,
			),
		).toBeVisible();
		first.unmount();
		expect(localStorage.getItem(EXPLAINER_KEY)).toBe("true");
		renderSync();
		await screen.findByRole("list", { name: "Групи змін" });
		expect(
			screen.queryByText(
				/Без вашого підтвердження на сайті нічого не змінюється/,
			),
		).not.toBeInTheDocument();
	});

	it("confirms the safe group with the same counts as its line, then shows the banner", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock.onPost(PREVIEW_URL).reply(200, { ...linksPreview, count: 29_457 });
		mock.onPost(APPROVE_URL).reply(200, {
			id: 31,
			action: "apply",
			outcome: "applied",
			counts: { applied: 29_457 },
			error: "",
		});
		renderSync();

		// Act
		await user.click(
			await screen.findByRole("button", { name: /Підтвердити всі 29\s457/ }),
		);
		const dialog = await screen.findByRole("dialog");
		await within(dialog).findByText(/Список той самий/);

		// Assert
		expect(dialog).toHaveTextContent(/Дисципліни5\s116/);
		expect(dialog).toHaveTextContent(/Семестри цих дисциплін24\s290/);
		expect(dialog).toHaveTextContent(/Факультети й кафедри51/);
		expect(dialog).toHaveTextContent(/Разом29\s457/);
		await user.click(
			within(dialog).getByRole("button", { name: /Підтвердити 29\s457/ }),
		);
		expect(await screen.findByRole("status")).toHaveTextContent(
			/Готово: підтверджено 29\s457/,
		);
		expect(bodyOf(mock, APPROVE_URL)[0]).toMatchObject({
			group: "link",
			token: linksPreview.token,
			selection: { filter: { group: "link" } },
		});
		expect(
			screen.getByRole("button", { name: "Відкрити в історії" }),
		).toBeInTheDocument();
	});

	it("asks to review again when the list changed", async () => {
		// Arrange
		const user = userEvent.setup();
		mock = mockSync();
		mock.onPost(PREVIEW_URL).reply(200, linksPreview);
		mock.onPost(APPROVE_URL).reply(409, {
			detail: "Список змінився: було 2, стало 3. Перегляньте ще раз",
			code: "selection_changed",
			status: 409,
			holder: null,
		});
		renderSync();

		// Act
		await user.click(
			await screen.findByRole("button", { name: /Підтвердити всі/ }),
		);
		const dialog = await screen.findByRole("dialog");
		await within(dialog).findByText(
			/Список змінився, поки ви його переглядали/,
		);
		await user.click(
			within(dialog).getByRole("button", { name: /Підтвердити 29/ }),
		);

		// Assert
		expect(await within(dialog).findByRole("alert")).toHaveTextContent(
			"Список змінився: було 2, стало 3",
		);
		expect(
			within(dialog).getByRole("button", { name: "Переглянути ще раз" }),
		).toBeInTheDocument();
	});

	it("moves a finished group to the bottom as done", async () => {
		// Arrange
		mock = mockSync({
			...catalogSummary,
			groups: {
				...catalogSummary.groups,
				links: {
					courses: 0,
					offerings: 0,
					faculties: 0,
					departments: 0,
					total: 0,
				},
			},
		});
		mock
			.onGet(`${SYNC_URL}/runs/7/approvals/`)
			.reply(200, listPage([appliedApproval]));

		// Act
		renderSync();

		// Assert
		const groups = await screen.findByRole("list", { name: "Групи змін" });
		await waitFor(() =>
			expect(within(groups).getAllByRole("listitem").at(-1)).toHaveTextContent(
				/позначено як ті самі, що в САЗ/,
			),
		);
		expect(
			within(groups).getAllByRole("button", { name: "Переглянути" }),
		).toHaveLength(2);
	});

	it("says everything is decided when nothing waits", async () => {
		// Arrange
		mock = mockSync(emptySummary);

		// Act
		renderSync();

		// Assert
		expect(await screen.findByText("Усе вирішено")).toBeInTheDocument();
		expect(
			screen.getByText(/Наступна перевірка — завтра о 02:30/),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Що застосовано сьогодні" }),
		).toBeInTheDocument();
	});

	it("shows an empty state before the first run", async () => {
		// Arrange
		mock = mockSync();
		mock.onGet(SUMMARY_URL).reply(404, { detail: "Not found", status: 404 });

		// Act
		renderSync();

		// Assert
		expect(
			await screen.findByText("Порівняння з САЗ ще не запускалось"),
		).toBeInTheDocument();
	});

	it("shows an error with a retry", async () => {
		// Arrange
		mock = mockSync();
		mock.onGet(SUMMARY_URL).reply(500, { detail: "Server error", status: 500 });

		// Act
		renderSync();

		// Assert
		expect(
			await screen.findByText("Не вдалося завантажити зміни з САЗ"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /Спробувати/ }),
		).toBeInTheDocument();
	});

	it("says the key has no access on ukma_data_forbidden", async () => {
		// Arrange
		mock = mockSync();
		mock.onGet(SUMMARY_URL).reply(403, {
			detail: "Ключ UKMA Data цього сервера не має доступу до цього розділу",
			code: "ukma_data_forbidden",
			status: 403,
		});

		// Act
		renderSync();

		// Assert
		expect(
			await screen.findByText(/У сайту немає дозволу бачити цей розділ/),
		).toBeInTheDocument();
		expect(screen.queryByText(/суперкористувач/)).not.toBeInTheDocument();
	});
});
