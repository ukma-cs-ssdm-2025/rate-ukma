import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	approval,
	approvalsUrl,
	CASES_URL,
	emptySummary,
	failedRun,
	keyStatus,
	listPage,
	NOW,
	rejection,
	run,
	RUNS_URL,
	STATUS_URL,
	summary,
	SUMMARY_URL,
} from "./dataTestData";
import { OverviewPage } from "./OverviewPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

let mock: MockAdapter;

function renderOverview() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<OverviewPage />
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(STATUS_URL).reply(200, keyStatus);
	mock.onGet(SUMMARY_URL).reply(200, summary);
	mock.onGet(RUNS_URL).reply(200, listPage([run]));
	mock.onGet(approvalsUrl(7)).reply(200, listPage([rejection, approval]));
	mock.onGet(CASES_URL, { params: { status: "open", limit: 1 } }).reply(200, {
		items: [{}],
		cursor: 0,
		has_more: true,
		data_updated_at: null,
		total: 37,
	});
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

describe("/data overview", () => {
	it("lists what waits as steps in apply order", async () => {
		// Act
		renderOverview();

		// Assert
		const list = within(
			await screen.findByRole("list", { name: "Що чекає рішення" }),
		);
		const items = list.getAllByRole("listitem");
		expect(items).toHaveLength(6);
		expect(items[0]).toHaveTextContent("Звʼязки без змін на сайті");
		expect(items[1]).toHaveTextContent(
			"Нові записиКурси в семестрі 772, курси 40.812",
		);
		expect(items[3]).toHaveTextContent("Зміни на сторінках з оцінками");
		expect(screen.getByText("Разом 1 284 зміни.")).toBeInTheDocument();
		expect(
			screen.getByText(/немає семестру 5, нуль кредитів 2/),
		).toBeInTheDocument();
	});

	it("says when САЗ was read, relative time first", async () => {
		// Act
		renderOverview();

		// Assert
		expect(await screen.findByText("3 год тому")).toBeInTheDocument();
		expect(screen.getByText("5 год тому")).toBeInTheDocument();
	});

	it("shows the full date in a tooltip on a relative time", async () => {
		// Arrange
		vi.useRealTimers();
		vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
		const user = userEvent.setup();
		renderOverview();

		// Act
		await user.hover(await screen.findByText("3 год тому"));

		// Assert
		expect(await screen.findByRole("tooltip")).toHaveTextContent(
			"10 вересня 2030",
		);
	});

	it("names who applied and who rejected, and when", async () => {
		// Act
		renderOverview();

		// Assert
		const list = within(
			await screen.findByRole("list", { name: "Останні рішення" }),
		);
		const [rejected, applied] = list.getAllByRole("listitem");
		expect(rejected).toHaveTextContent("Відхилено");
		expect(rejected).toHaveTextContent("o.testenko, 2 год тому");
		expect(applied).toHaveTextContent("ЗастосованоЗміни, 142 зміни");
	});

	it("counts the open UKMA Data cases in one line", async () => {
		// Act
		renderOverview();

		// Assert
		const line = await screen.findByRole("link", { name: /Відкритих/ });
		expect(line).toHaveAttribute("href", "/data/cases");
		expect(line.parentElement).toHaveTextContent("Відкритих справ: 37.");
	});

	it("warns when the latest read failed", async () => {
		// Arrange
		mock.onGet(RUNS_URL).reply(200, listPage([failedRun]));

		// Act
		renderOverview();

		// Assert
		expect(await screen.findByText(/не вдалася/)).toHaveTextContent(
			"UKMA Data віддала неповні дані. Нижче — дані останнього вдалого.",
		);
	});

	it("says nothing waits when every group is empty", async () => {
		// Arrange
		mock.onGet(SUMMARY_URL).reply(200, emptySummary);

		// Act
		renderOverview();

		// Assert
		expect(
			await screen.findByText("Нічого не чекає. Наступне читання САЗ уночі."),
		).toBeInTheDocument();
	});

	it("has no control that applies, rejects or answers", async () => {
		// Act
		renderOverview();
		await screen.findByRole("list", { name: "Що чекає рішення" });

		// Assert
		expect(
			screen.queryByRole("button", {
				name: /застосувати|підтвердити|відхилити|відповісти/i,
			}),
		).not.toBeInTheDocument();
	});
});
