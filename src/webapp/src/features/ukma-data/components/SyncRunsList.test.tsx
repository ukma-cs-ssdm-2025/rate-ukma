import { StrictMode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	failedRun,
	listPage,
	NOW,
	PENDING_URL,
	pending,
	POLICIES_URL,
	POLICY_CHANGES_URL,
	RUNS_URL,
	run,
} from "./dataTestData";
import { JOURNAL_URL, journalApply } from "./syncActionsTestData";
import { SyncPage } from "./SyncPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

let mock: MockAdapter;

function renderHistory() {
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

beforeEach(() => {
	vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(PENDING_URL).reply(200, pending([]));
	mock.onGet(POLICIES_URL).reply(200, { items: [] });
	mock.onGet(POLICY_CHANGES_URL).reply(200, { items: [] });
	mock
		.onGet(JOURNAL_URL)
		.reply(200, { items: [journalApply], next_before: null });
	mock.onGet(RUNS_URL).reply(200, listPage([failedRun, run]));
	mock.onGet(`${RUNS_URL}${failedRun.id}/`).reply(200, failedRun);
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

describe("/data sync journal tab", () => {
	it("keeps the nightly reads under the Журнал, failed ones too", async () => {
		// Arrange & Act
		renderHistory();

		// Assert
		expect(
			await screen.findByRole("list", { name: "Журнал" }),
		).toBeInTheDocument();
		const reads = within(
			await screen.findByRole("list", { name: "Читання САЗ" }),
		);
		expect(reads.getAllByRole("listitem")).toHaveLength(2);
		expect(
			reads.getByRole("button", { name: `Відкрити читання ${failedRun.id}` }),
		).toBeInTheDocument();
	});

	it("opens a read and comes back to the Журнал", async () => {
		// Arrange
		const user = userEvent.setup();
		renderHistory();

		// Act
		await user.click(
			await screen.findByRole("button", {
				name: `Відкрити читання ${failedRun.id}`,
			}),
		);

		// Assert
		expect(
			await screen.findByRole("heading", {
				name: `Читання САЗ #${failedRun.id}`,
			}),
		).toBeInTheDocument();
		await user.click(screen.getByRole("button", { name: /Журнал/ }));
		expect(
			await screen.findByRole("list", { name: "Журнал" }),
		).toBeInTheDocument();
		expect(
			await screen.findByRole("list", { name: "Читання САЗ" }),
		).toBeInTheDocument();
	});
});
