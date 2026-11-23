import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import type { SyncJournalEntry } from "@/lib/api/generated";
import {
	keyStatusWithDecide,
	NOW,
	PENDING_URL,
	pending,
	POLICIES_URL,
	POLICY_CHANGES_URL,
	STATUS_URL,
} from "./dataTestData";
import {
	JOURNAL_URL,
	journalDecisionMerge,
	journalDecisionRefused,
} from "./syncActionsTestData";
import { SyncPage } from "./SyncPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

const UNMERGE_URL = "/api/v1/ukma-data/courses/c-101/unmerge/";

const journalDecisionUnmerge: SyncJournalEntry = {
	...journalDecisionMerge,
	id: 33,
	when: "2030-09-10T13:00:00Z",
	counts: { action: "unmerge_course", target_id: "c-101", related_id: "" },
};

const journalDecisionFailed: SyncJournalEntry = {
	...journalDecisionMerge,
	id: 34,
	outcome: "failed",
	error: "UKMA Data is unreachable.",
	counts: { action: "merge_course", target_id: "c-105", related_id: "c-106" },
};

let mock: MockAdapter;

function renderJournal(items: SyncJournalEntry[]) {
	mock.onGet(JOURNAL_URL).reply(200, { items, next_before: null });
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<StrictMode>
			<QueryClientProvider client={queryClient}>
				<NuqsTestingAdapter searchParams="?tab=history" hasMemory>
					<SyncPage />
				</NuqsTestingAdapter>
			</QueryClientProvider>
		</StrictMode>,
	);
}

const unmergeRequests = () =>
	mock.history.post.filter((request) => request.url === UNMERGE_URL);

beforeEach(() => {
	vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
	mock.onGet(PENDING_URL).reply(200, pending([]));
	mock.onGet(POLICIES_URL).reply(200, { items: [] });
	mock.onGet(POLICY_CHANGES_URL).reply(200, { items: [] });
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

describe("/data/sync journal: UKMA Data decisions", () => {
	it("shows a decision with its error and offers to unmerge a done merge", async () => {
		// Arrange
		const user = userEvent.setup();
		mock.onPost(UNMERGE_URL).reply(200, {
			decision_id: 33,
			action: "unmerge_course",
			outcome: "done",
			detail: "Курс роз'єднано.",
		});

		// Act
		renderJournal([journalDecisionMerge, journalDecisionRefused]);
		const list = within(await screen.findByRole("list", { name: "Журнал" }));
		const items = list.getAllByRole("listitem");
		await user.click(
			within(items[0]).getByRole("button", { name: "Роз'єднати" }),
		);
		const dialog = await screen.findByRole("alertdialog");
		await user.click(
			within(dialog).getByRole("button", { name: "Роз'єднати" }),
		);

		// Assert
		expect(items[0]).toHaveTextContent("Рішення в UKMA Data: об'єднано");
		expect(items[1]).toHaveTextContent(
			"Рішення в UKMA Data: об'єднано — відмова",
		);
		expect(items[1]).toHaveTextContent(
			"Курси різного рівня: об'єднати можна лише однакові.",
		);
		expect(dialog).toHaveTextContent("Роз'єднати курс c-101?");
		expect(await screen.findByText("Курс роз'єднано.")).toBeInTheDocument();
		await waitFor(() => expect(unmergeRequests()).toHaveLength(1));
	});

	it("does not offer to unmerge a merge a newer unmerge undid", async () => {
		// Act
		renderJournal([journalDecisionUnmerge, journalDecisionMerge]);

		// Assert
		const list = within(await screen.findByRole("list", { name: "Журнал" }));
		expect(list.getAllByRole("listitem")).toHaveLength(2);
		expect(
			list.queryByRole("button", { name: "Роз'єднати" }),
		).not.toBeInTheDocument();
	});

	it("says in Ukrainian that a failed decision may not have been written", async () => {
		// Act
		renderJournal([journalDecisionFailed]);

		// Assert
		expect(
			await screen.findByText(
				"UKMA Data не відповіла, тож рішення могло й не записатися. Перевірте, перш ніж повторювати.",
			),
		).toBeInTheDocument();
		expect(
			screen.queryByText("UKMA Data is unreachable."),
		).not.toBeInTheDocument();
	});
});
