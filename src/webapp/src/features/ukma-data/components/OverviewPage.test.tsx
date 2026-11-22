import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	casePage,
	CASES_URL,
	forbidden,
	keyStatus,
	NOW,
	removalCase,
	STATUS_URL,
	studentCase,
} from "./caseTestData";
import { OverviewPage } from "./OverviewPage";
import { catalogSummary, emptySummary, SYNC_URL } from "./syncTestData";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

const SUMMARY_URL = `${SYNC_URL}/summary/`;

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

const lines = async () =>
	within(await screen.findByRole("list", { name: "Що чекає рішення" }));

beforeEach(() => {
	vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(STATUS_URL).reply(200, keyStatus);
	mock.onGet(SUMMARY_URL).reply(200, catalogSummary);
});

afterEach(() => {
	mock.restore();
	vi.useRealTimers();
});

describe("/data overview", () => {
	it("says what waits, with real counts and one button per line", async () => {
		// Arrange
		mock
			.onGet(CASES_URL)
			.reply(
				200,
				casePage([
					...Array.from({ length: 9 }, (_, index) => studentCase(index)),
					removalCase,
				]),
			);

		// Act
		renderOverview();

		// Assert
		const list = await lines();
		expect(
			await list.findByText(
				"9 справ про студентів чекають рішення в сервісі даних САЗ (найстаріша — 8 днів)",
			),
		).toBeInTheDocument();
		expect(
			list.getByText(
				"1 справа про зниклі з САЗ семестри чекає рішення в сервісі даних САЗ (найстаріша — 1 день)",
			),
		).toBeInTheDocument();
		expect(list.getByText(/змін із САЗ чекають рішення$/)).toBeInTheDocument();
		expect(list.getAllByText("Вирішують поза сайтом")).toHaveLength(2);
		expect(document.body).not.toHaveTextContent("Треба вибрати вручну");
		expect(document.body).not.toHaveTextContent("Поки ви не вирішите");
		const buttons = list.getAllByRole("link", { name: "Переглянути" });
		expect(buttons.map((link) => link.getAttribute("href"))).toEqual([
			"/data/sync",
			"/data/cases",
			"/data/cases",
		]);
		expect(
			mock.history.get.find((call) => call.url === CASES_URL)?.params,
		).toEqual({
			limit: 1000,
			status: "open",
		});
	});

	it("shows quiet done lines when nothing waits", async () => {
		// Arrange
		mock.onGet(SUMMARY_URL).reply(200, emptySummary);
		mock.onGet(CASES_URL).reply(200, casePage([]));

		// Act
		renderOverview();

		// Assert
		const list = await lines();
		expect(
			await list.findByText("Зміни з САЗ: усе вирішено"),
		).toBeInTheDocument();
		expect(await list.findByText("Справи: усе вирішено")).toBeInTheDocument();
		expect(list.queryByRole("link")).not.toBeInTheDocument();
	});

	it("says cases can't be shown when the key lacks their scope, and keeps the sync line", async () => {
		// Arrange
		mock
			.onGet(STATUS_URL)
			.reply(200, { ...keyStatus, scopes: ["catalog:read"] });
		mock.onGet(CASES_URL).reply(403, forbidden);

		// Act
		renderOverview();

		// Assert
		const list = await lines();
		expect(
			await list.findByText("Справи не можна показати"),
		).toBeInTheDocument();
		expect(
			list.getByText(/У сайту немає дозволу бачити цей розділ/),
		).toBeInTheDocument();
		expect(list.getByRole("link", { name: "Переглянути" })).toHaveAttribute(
			"href",
			"/data/sync",
		);
		expect(
			screen.getByText(
				/Ключ не має права review:read, тому справи тут не показано/,
			),
		).toBeInTheDocument();
		expect(screen.queryByText(/суперкористувач/)).not.toBeInTheDocument();
		expect(
			mock.history.get.some((call) => call.url?.includes("/auth/session")),
		).toBe(false);
	});

	it("keeps the key id and scopes in collapsed technical details", async () => {
		// Arrange
		mock.onGet(CASES_URL).reply(200, casePage([]));

		// Act
		renderOverview();

		// Assert
		const details = (await screen.findByText("Технічні деталі")).closest(
			"details",
		);
		expect(details).not.toHaveAttribute("open");
		expect(details).toHaveTextContent("key-test-1");
		expect(details).toHaveTextContent("catalog:read, review:read");
		expect(
			screen.getByText(
				/Дані САЗ станом на 10 вересня, 06:55 · перевірено \d+ вересня, \d\d:\d\d/,
			),
		).toBeInTheDocument();
		expect(document.body).not.toHaveTextContent("UKMA Data");
	});

	it("offers a retry in the line when the data service is down", async () => {
		// Arrange
		mock.onGet(CASES_URL).reply(502, { detail: "x", status: 502 });

		// Act
		renderOverview();

		// Assert
		const list = await lines();
		expect(
			await list.findByText("Дані САЗ зараз недоступні"),
		).toBeInTheDocument();
		expect(
			list.getByRole("button", { name: "Спробувати знову" }),
		).toBeInTheDocument();
	});

	it("says the comparison has not run yet on 404", async () => {
		// Arrange
		mock.onGet(SUMMARY_URL).reply(404, { detail: "x", status: 404 });
		mock.onGet(CASES_URL).reply(200, casePage([]));

		// Act
		renderOverview();

		// Assert
		expect(
			await (await lines()).findByText("Зміни з САЗ ще не перевіряли"),
		).toBeInTheDocument();
	});

	it("shows the error with retry when the status fails", async () => {
		// Arrange
		mock.onGet(STATUS_URL).reply(500);
		mock.onGet(CASES_URL).reply(200, casePage([]));

		// Act
		renderOverview();

		// Assert
		expect(
			await screen.findByText("Не вдалося завантажити огляд"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Спробувати знову" }),
		).toBeInTheDocument();
	});

	it("shows a skeleton while loading", () => {
		// Arrange
		mock.onGet(STATUS_URL).reply(() => new Promise(() => {}));

		// Act
		renderOverview();

		// Assert
		expect(screen.getByLabelText("Завантаження")).toBeInTheDocument();
	});
});
