import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import { SyncPage } from "./SyncPage";
import {
	catalogSummary,
	linksPreview,
	listPage,
	pendingLinks,
	SYNC_URL,
} from "./syncTestData";

let mockAxios: MockAdapter;

function renderPage(search: string) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams={search} hasMemory>
				<SyncPage />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
}

function mockReview() {
	mockAxios.onGet(`${SYNC_URL}/summary/`).reply(200, catalogSummary);
	mockAxios.onGet(`${SYNC_URL}/approvals/active/`).reply(200, { item: null });
	mockAxios.onGet(`${SYNC_URL}/runs/7/approvals/`).reply(200, listPage([]));
	mockAxios.onGet(`${SYNC_URL}/runs/`).reply(200, listPage([]));
	mockAxios.onGet(`${SYNC_URL}/pending/`).reply(200, pendingLinks);
}

const body = (data: unknown): unknown =>
	typeof data === "string" ? JSON.parse(data) : data;

async function openBulk() {
	const user = userEvent.setup();
	renderPage("?group=exact_links&kind=link_course");
	await user.click(
		await screen.findByRole("button", { name: /Застосувати всі/ }),
	);
	return { user, dialog: await screen.findByRole("dialog") };
}

beforeEach(() => {
	mockAxios = new MockAdapter(authorizedHttpClient);
	mockReview();
});

afterEach(() => {
	mockAxios.restore();
});

describe("sync apply flow", () => {
	it("previews, confirms with the token and a client key, and shows the result", async () => {
		// Arrange
		mockAxios.onPost(`${SYNC_URL}/preview/`).reply(200, linksPreview);
		mockAxios.onPost(`${SYNC_URL}/approve/`).reply(200, {
			id: 31,
			action: "apply",
			outcome: "applied",
			counts: { applied: 4828, superseded: 2, waiting: 0, skipped: 0 },
			error: "",
		});
		const { user, dialog } = await openBulk();

		// Act
		await user.click(
			await within(dialog).findByRole("button", {
				name: /Застосувати 4\s828 звʼязків/,
			}),
		);

		// Assert
		expect(body(mockAxios.history.post[0].data)).toEqual({
			source: "catalog",
			run: 7,
			selection: {
				filter: { group: "link", match: "exact", kind: "link_course" },
			},
		});
		const approve = body(mockAxios.history.post[1].data);
		expect(approve).toMatchObject({
			source: "catalog",
			run: 7,
			token: "7:5f1c",
			confirm_stale: false,
			selection: {
				filter: { group: "link", match: "exact", kind: "link_course" },
			},
		});
		expect(approve).toHaveProperty("client_key", expect.any(String));
		expect(await screen.findByText("Готово")).toBeInTheDocument();
		expect(
			screen.getByText(/Застосовано 4\s828 · уже неактуальні 2/),
		).toHaveTextContent("Запуск 7");
		expect(
			screen.getByRole("button", { name: "Відкрити в історії" }),
		).toBeEnabled();
		expect(
			screen.getByRole("button", { name: "Наступний крок" }),
		).toBeEnabled();
	});

	it("needs the moves and age ticks before it confirms", async () => {
		// Arrange
		mockAxios.onPost(`${SYNC_URL}/preview/`).reply(200, {
			...linksPreview,
			ratings_moved: 41,
			plans_moved: 3,
			run_age_hours: 50,
		});
		const { user, dialog } = await openBulk();
		const confirm = await within(dialog).findByRole("button", {
			name: /Перенести 41 оцінку й застосувати/,
		});

		// Act
		expect(confirm).toBeDisabled();
		await user.click(
			within(dialog).getByRole("checkbox", {
				name: "Я переглянув(-ла) список перенесень",
			}),
		);
		expect(confirm).toBeDisabled();
		await user.click(
			within(dialog).getByRole("checkbox", { name: /50 год тому/ }),
		);

		// Assert
		expect(confirm).toBeEnabled();
		expect(dialog).toHaveTextContent(/41 оцінка · 3 плани/);
	});

	it("explains a changed list and previews again", async () => {
		// Arrange
		mockAxios.onPost(`${SYNC_URL}/preview/`).reply(200, linksPreview);
		mockAxios.onPost(`${SYNC_URL}/approve/`).reply(409, {
			detail: "Список змінився: було 4830, стало 4829. Перегляньте ще раз",
			code: "selection_changed",
			status: 409,
			holder: "other_user",
			run_age_hours: 7,
		});
		const { user, dialog } = await openBulk();

		// Act
		await user.click(
			await within(dialog).findByRole("button", { name: /Застосувати 4\s828/ }),
		);
		const alert = await within(dialog).findByRole("alert");
		await user.click(
			within(alert).getByRole("button", { name: "Переглянути ще раз" }),
		);

		// Assert
		expect(alert).toHaveTextContent("Список змінився: було 4830, стало 4829");
		expect(alert).toHaveTextContent(
			"Зараз зміни застосовує інший адміністратор.",
		);
		await waitFor(() =>
			expect(
				mockAxios.history.post.filter((call) =>
					call.url?.endsWith("/preview/"),
				),
			).toHaveLength(2),
		);
	});

	it("names the nightly run that holds the lock", async () => {
		// Arrange
		mockAxios.onPost(`${SYNC_URL}/preview/`).reply(200, linksPreview);
		mockAxios.onPost(`${SYNC_URL}/approve/`).reply(409, {
			detail: "Синхронізація саме триває",
			status: 409,
			holder: "nightly",
			run_age_hours: 7,
		});
		const { user, dialog } = await openBulk();

		// Act
		await user.click(
			await within(dialog).findByRole("button", { name: /Застосувати 4\s828/ }),
		);

		// Assert
		const alert = await within(dialog).findByRole("alert");
		expect(alert).toHaveTextContent("Синхронізація саме триває");
		expect(alert).toHaveTextContent(
			"Зараз триває нічний запуск синхронізації.",
		);
		expect(
			within(alert).queryByRole("button", { name: "Переглянути ще раз" }),
		).toBeNull();
	});

	it("applies selected rows by id", async () => {
		// Arrange
		const user = userEvent.setup();
		mockAxios.onPost(`${SYNC_URL}/preview/`).reply(200, linksPreview);
		renderPage("?group=exact_links&kind=link_course");

		// Act
		await user.click(
			await screen.findByRole("checkbox", {
				name: "Вибрати: Основи числових методів",
			}),
		);
		const bar = screen.getByRole("region", { name: "Дії з вибраними" });
		await user.click(within(bar).getByRole("button", { name: "Застосувати" }));

		// Assert
		expect(bar).toHaveTextContent("Вибрано 1");
		await waitFor(() =>
			expect(body(mockAxios.history.post[0].data)).toEqual({
				source: "catalog",
				run: 7,
				selection: { change_ids: [101] },
			}),
		);
	});

	it("rejects selected rows after a confirm", async () => {
		// Arrange
		const user = userEvent.setup();
		mockAxios.onPost(`${SYNC_URL}/reject/`).reply(200, {
			id: 32,
			action: "reject",
			outcome: "applied",
			counts: { rejected: 1, superseded: 0 },
			error: "",
		});
		renderPage("?group=exact_links&kind=link_course&ids=101");
		const bar = await screen.findByRole("region", { name: "Дії з вибраними" });

		// Act
		await user.click(within(bar).getByRole("button", { name: "Відхилити" }));
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Відхилити",
			}),
		);

		// Assert
		await waitFor(() =>
			expect(body(mockAxios.history.post[0].data)).toEqual({
				change_ids: [101],
			}),
		);
	});
});
