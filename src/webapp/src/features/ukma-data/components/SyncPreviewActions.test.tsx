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
	decisionResponse,
	JOURNAL_URL,
	journalApply,
	journalRejected,
	PREVIEW_URL,
	previewFixture,
	REJECT_URL,
} from "./syncActionsTestData";
import { SyncJournal } from "./SyncJournal";
import { SyncPreviewPage } from "./SyncPreviewPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

const REFUSAL = {
	code: "selection_changed",
	detail: "server text",
	status: 409,
	decision_id: null,
};

let mock: MockAdapter;

function renderPreview() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams="?group=link" hasMemory>
				<SyncPreviewPage />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
}

function renderPreviewAndJournal() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams="?group=link" hasMemory>
				<SyncPreviewPage />
				<SyncJournal />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
}

const postsTo = (url: string) =>
	mock.history.post.filter((request) => request.url === url);

const requestBodies = (url: string) =>
	postsTo(url).map((request) => JSON.parse(String(request.data)));

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

describe("/data/sync/preview actions", () => {
	it("sends nothing when the reject confirm is cancelled", async () => {
		// Arrange
		const user = userEvent.setup();

		// Act
		renderPreview();
		await user.click(await screen.findByRole("button", { name: /^Відхилити/ }));
		const dialog = await screen.findByRole("alertdialog");
		await user.click(within(dialog).getByRole("button", { name: "Закрити" }));

		// Assert
		expect(postsTo(REJECT_URL)).toHaveLength(0);
	});

	it("sends a new client_key for every apply attempt", async () => {
		// Arrange
		const user = userEvent.setup();
		mock.onPost(APPLY_URL).reply(409, REFUSAL);

		// Act
		renderPreview();
		await user.click(
			await screen.findByRole("button", { name: /^Застосувати/ }),
		);
		await screen.findByRole("alert");
		await user.click(
			screen.getByRole("button", { name: "Переглянути ще раз" }),
		);
		await user.click(
			await screen.findByRole("button", { name: /^Застосувати/ }),
		);

		// Assert
		await waitFor(() => expect(postsTo(APPLY_URL)).toHaveLength(2));
		const [first, second] = requestBodies(APPLY_URL);
		expect(first.client_key).not.toBe(second.client_key);
	});

	it("disables Закрити and focuses the result while a decision is written", async () => {
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
		expect(screen.getByRole("button", { name: "Закрити" })).toBeDisabled();
		expect(
			screen.queryByRole("link", { name: "Закрити" }),
		).not.toBeInTheDocument();
		release();
		await screen.findByText(/Застосовано 1 532 зміни\. Рішення #74\./);
		const status = screen.getByRole("status");
		expect(status).toHaveFocus();
		expect(status).toHaveTextContent("Застосовано 1 532 зміни. Рішення #74.");
	});

	it("shows only the loading state while a new preview loads", async () => {
		// Arrange
		const user = userEvent.setup();
		let release = () => {};
		let previewCalls = 0;
		mock.onPost(PREVIEW_URL).reply(() => {
			previewCalls += 1;
			if (previewCalls === 1) {
				return [200, previewFixture()];
			}
			return new Promise((resolve) => {
				release = () => resolve([200, previewFixture()]);
			});
		});
		mock.onPost(APPLY_URL).reply(409, REFUSAL);

		// Act
		renderPreview();
		await user.click(
			await screen.findByRole("button", { name: /^Застосувати/ }),
		);
		await screen.findByRole("alert");
		await user.click(
			screen.getByRole("button", { name: "Переглянути ще раз" }),
		);

		// Assert
		expect(screen.getByText("Завантажую…")).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /^Застосувати/ }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Переглянути ще раз" }),
		).not.toBeInTheDocument();
		release();
		expect(
			await screen.findByRole("button", { name: /^Застосувати/ }),
		).toBeInTheDocument();
	});

	it("drops the old preview actions when the refetch fails", async () => {
		// Arrange
		const user = userEvent.setup();
		let previewCalls = 0;
		mock.onPost(PREVIEW_URL).reply(() => {
			previewCalls += 1;
			return previewCalls === 1
				? [200, previewFixture()]
				: [500, { detail: "boom", status: 500 }];
		});
		mock.onPost(APPLY_URL).reply(409, REFUSAL);

		// Act
		renderPreview();
		await user.click(
			await screen.findByRole("button", { name: /^Застосувати/ }),
		);
		await screen.findByRole("alert");
		await user.click(
			screen.getByRole("button", { name: "Переглянути ще раз" }),
		);

		// Assert
		expect(
			await screen.findByText("Не вдалося завантажити."),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /^Застосувати/ }),
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: /^Відхилити/ }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Спробувати ще" }),
		).toBeInTheDocument();
	});

	it("shows the new decision in the journal after an apply", async () => {
		// Arrange
		const user = userEvent.setup();
		mock.onPost(APPLY_URL).reply(200, decisionResponse());
		let journalCalls = 0;
		mock.onGet(JOURNAL_URL).reply(() => {
			journalCalls += 1;
			return [
				200,
				{
					items:
						journalCalls === 1
							? [journalRejected]
							: [journalApply, journalRejected],
					next_before: null,
				},
			];
		});

		// Act
		renderPreviewAndJournal();
		await user.click(
			await screen.findByRole("button", { name: /^Застосувати/ }),
		);

		// Assert
		expect(
			await screen.findByText(decisionResponse().detail, { exact: false }),
		).toBeInTheDocument();
		expect(
			await screen.findByText(/Застосовано 1 855 \(Змінити\)/),
		).toBeInTheDocument();
		expect(journalCalls).toBeGreaterThan(1);
	});
});
