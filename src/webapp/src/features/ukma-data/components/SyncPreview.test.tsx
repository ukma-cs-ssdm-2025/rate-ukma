import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	NOW,
	PENDING_URL,
	pending,
	QUESTIONS_URL,
	question,
} from "./dataTestData";
import {
	APPLY_URL,
	changesFrom,
	decisionCounts,
	decisionResponse,
	overCapPreview,
	PREVIEW_URL,
	previewFixture,
	REJECT_URL,
	rejectedResponse,
} from "./syncActionsTestData";
import { SyncPreviewPage } from "./SyncPreviewPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

let mock: MockAdapter;

function renderPreview(search = "?group=link") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams={search} hasMemory>
				<SyncPreviewPage />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(PENDING_URL).reply(200, pending(changesFrom(20), 1532));
	mock.onPost(PREVIEW_URL).reply(200, previewFixture());
	mock.onGet(QUESTIONS_URL).reply(200, { items: [question], next_after: null });
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

describe("/data/sync/preview", () => {
	it("shows the summary, the data age and the first 20 rows", async () => {
		// Act
		renderPreview();

		// Assert
		expect(await screen.findByText(/Застосується/)).toHaveTextContent(
			"Застосується 1 532: курси в семестрі 973, курси 559.",
		);
		expect(
			screen.getByRole("heading", { name: /Зв'язати/ }),
		).toBeInTheDocument();
		expect(screen.getByText("Не увійде 0.")).toBeInTheDocument();
		expect(screen.getByText(/Дані САЗ станом на/)).toBeInTheDocument();
		const list = within(
			await screen.findByRole("list", { name: "Зміни до перегляду" }),
		);
		expect(list.getAllByRole("listitem")).toHaveLength(20);
		expect(screen.getByText(/Показано 20 з/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /^Застосувати/ }),
		).toBeInTheDocument();
	});

	it("offers the first 5 000 when the selection is over the cap", async () => {
		// Arrange
		mock.onPost(PREVIEW_URL).reply(200, overCapPreview);

		// Act
		renderPreview("?group=link&kind=link_offering");

		// Assert
		expect(
			await screen.findByRole("button", {
				name: /Застосувати перші 5.000 з 24.290/,
			}),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /^Відхилити 24.290 змін$/ }),
		).toBeInTheDocument();
	});

	it("shows that it is loading", async () => {
		// Arrange
		let release = () => {};
		mock.onPost(PREVIEW_URL).reply(
			() =>
				new Promise((resolve) => {
					release = () => resolve([200, previewFixture()]);
				}),
		);

		// Act
		renderPreview();

		// Assert
		expect(screen.getByText("Завантажую…")).toBeInTheDocument();
		await waitFor(() => expect(mock.history.post).toHaveLength(1));
		release();
		expect(await screen.findByText(/Застосується/)).toBeInTheDocument();
	});

	it("retries when the preview fails to load", async () => {
		// Arrange
		mock.onPost(PREVIEW_URL).reply(500, { detail: "boom", status: 500 });

		// Act
		renderPreview();

		// Assert
		expect(
			await screen.findByText("Не вдалося завантажити."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Спробувати ще" }),
		).toBeInTheDocument();
	});

	it("says nothing applies when the selection has nothing to write", async () => {
		// Arrange
		mock.onPost(PREVIEW_URL).reply(
			200,
			previewFixture({
				counts: decisionCounts({ waiting: 213, total: 213 }),
			}),
		);

		// Act
		renderPreview("?group=change");

		// Assert
		expect(
			await screen.findByText("Нічого не застосовувати."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /^Застосувати/ }),
		).not.toBeInTheDocument();
	});

	it("does not apply mapping questions here", async () => {
		// Arrange
		mock.onPost(PREVIEW_URL).reply(
			200,
			previewFixture({
				counts: decisionCounts({ waiting: 18, total: 18 }),
			}),
		);

		// Act
		renderPreview("?group=mapping");

		// Assert
		expect(
			await screen.findByText(/Питання вирішують у консолі:/),
		).toBeInTheDocument();
		expect(screen.getByText("catalog_sync answer")).toBeInTheDocument();
		expect(
			await screen.findByRole("list", { name: "Питання" }),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /^Застосувати/ }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /^Відхилити/ }),
		).not.toBeInTheDocument();
	});

	it("does not apply changes that disappeared from САЗ", async () => {
		// Arrange
		mock.onPost(PREVIEW_URL).reply(
			200,
			previewFixture({
				counts: decisionCounts({ applied: 3, total: 3 }),
			}),
		);

		// Act
		renderPreview("?group=removed");

		// Assert
		expect(
			await screen.findByText(
				"Нічого не застосовувати: зниклі записи сайт не видаляє.",
			),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /^Застосувати/ }),
		).not.toBeInTheDocument();
	});

	it("applies with the preview token and shows the decision", async () => {
		// Arrange
		const user = userEvent.setup();
		let release = () => {};
		mock.onPost(APPLY_URL).reply(
			() =>
				new Promise((resolve) => {
					release = () => resolve([200, decisionResponse()]);
				}),
		);

		// Act
		renderPreview();
		await user.click(
			await screen.findByRole("button", { name: /^Застосувати/ }),
		);

		// Assert
		expect(screen.getByText("Застосовую 1 532 зміни…")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /^Застосувати/ })).toBeDisabled();
		expect(screen.getByRole("button", { name: /^Відхилити/ })).toBeDisabled();
		release();
		expect(
			await screen.findByText(/Застосовано 1 532 зміни\. Рішення #74\./),
		).toBeInTheDocument();
		expect(screen.getByText("✓")).toHaveAttribute("aria-hidden", "true");
		expect(
			screen.getByRole("link", { name: "Відкрити в Журналі" }),
		).toHaveAttribute("href", "/data/sync");
		const body = JSON.parse(String(mock.history.post.at(-1)?.data));
		expect(body).toMatchObject({
			source: "catalog",
			group: "link",
			kind: null,
			token: "token-test",
		});
		expect(body.client_key).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
		);
	});

	it("treats a 504 as a lost answer and links the journal", async () => {
		// Arrange
		const user = userEvent.setup();
		mock.onPost(APPLY_URL).reply(504, { detail: "gateway", status: 504 });

		// Act
		renderPreview();
		await user.click(
			await screen.findByRole("button", { name: /^Застосувати/ }),
		);

		// Assert
		expect(
			await screen.findByText(/Відповідь не прийшла\. Перевірте Журнал/),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Журнал" })).toHaveAttribute(
			"href",
			"/data/sync",
		);
	});

	it("confirms a rejection and shows its decision", async () => {
		// Arrange
		const user = userEvent.setup();
		mock.onPost(REJECT_URL).reply(200, rejectedResponse);

		// Act
		renderPreview();
		await user.click(await screen.findByRole("button", { name: /^Відхилити/ }));
		const dialog = await screen.findByRole("alertdialog");

		// Assert
		expect(dialog).toHaveTextContent("Відхилити 1 532 зміни?");
		expect(dialog).toHaveTextContent(
			"На сайті нічого не зміниться. Вони повернуться після наступного читання, якщо САЗ не зміниться.",
		);
		await user.click(within(dialog).getByRole("button", { name: "Відхилити" }));
		expect(
			await screen.findByText(/Відхилено 1 532 зміни\. Рішення #75\./),
		).toBeInTheDocument();
		const body = JSON.parse(String(mock.history.post.at(-1)?.data));
		expect(body).toMatchObject({
			run: previewFixture().run.id,
			source: "catalog",
			group: "link",
			kind: null,
		});
		expect(body.client_key).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("offers the rest after a capped apply", async () => {
		// Arrange
		const user = userEvent.setup();
		mock.onPost(PREVIEW_URL).reply(200, overCapPreview);
		mock.onPost(APPLY_URL).reply(
			200,
			decisionResponse({
				counts: decisionCounts({
					applied: 5000,
					total: 5000,
					remaining: 19_290,
				}),
				detail: "Застосовано 5 000 змін. Рішення #74.",
			}),
		);

		// Act
		renderPreview();
		await user.click(
			await screen.findByRole("button", {
				name: /Застосувати перші 5.000 з 24.290/,
			}),
		);

		// Assert
		expect(
			await screen.findByText(/Застосовано 5 000 змін\. Рішення #74\./),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: "Переглянути решту" }));
		expect(
			mock.history.post.filter((request) => request.url === PREVIEW_URL),
		).toHaveLength(2);
	});

	it("loads a fresh preview when the group is opened again", async () => {
		// Arrange
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
		});
		const open = () =>
			render(
				<QueryClientProvider client={queryClient}>
					<NuqsTestingAdapter searchParams="?group=link" hasMemory>
						<SyncPreviewPage />
					</NuqsTestingAdapter>
				</QueryClientProvider>,
			);

		// Act
		const first = open();
		await screen.findByText(/Застосується/);
		first.unmount();
		open();

		// Assert
		expect(await screen.findByText(/Застосується/)).toBeInTheDocument();
		await waitFor(() =>
			expect(
				mock.history.post.filter((request) => request.url === PREVIEW_URL),
			).toHaveLength(2),
		);
	});
});
