import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import type { UkmaDataStatus } from "@/lib/api/generated";
import { OverviewPage } from "./OverviewPage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
}));

const STATUS_URL = "/api/v1/ukma-data/status/";
const CASES_URL = "/api/v1/ukma-data/review-cases/";

const status: UkmaDataStatus = {
	key_id: "key-test",
	scopes: ["catalog:read"],
	key_expires_at: "2030-01-01T00:00:00Z",
	data_updated_at: "2030-09-01T00:00:00Z",
};

let mockAxios: MockAdapter;

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
	mockAxios = new MockAdapter(authorizedHttpClient);
	mockAxios.onGet(STATUS_URL).reply(200, status);
});

afterEach(() => {
	mockAxios.restore();
});

describe("/data overview", () => {
	it("says the key has no access to cases and keeps the other panels", async () => {
		mockAxios.onGet(CASES_URL).reply(403, {
			detail: "Ключ UKMA Data цього сервера не має доступу до цього розділу",
			code: "ukma_data_forbidden",
			status: 403,
		});

		renderOverview();

		expect(
			await screen.findByText("Немає доступу до цих даних UKMA Data"),
		).toBeInTheDocument();
		expect(
			screen.getByText(/не має доступу до цього розділу/),
		).toBeInTheDocument();
		expect(screen.getByText("Дані САЗ")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Відкрити синхронізацію" }),
		).toHaveAttribute("href", "/data/sync");
		expect(
			screen.queryByText("Розділ лише для суперкористувачів"),
		).not.toBeInTheDocument();
		expect(
			screen.queryByText("UKMA Data зараз недоступний"),
		).not.toBeInTheDocument();
		expect(
			mockAxios.history.get.some((request) =>
				request.url?.includes("/auth/session"),
			),
		).toBe(false);
	});

	it("says UKMA Data is unavailable inside the cases panel only on 502", async () => {
		mockAxios.onGet(CASES_URL).reply(502, {
			detail: "UKMA Data did not answer in time.",
			status: 502,
		});

		renderOverview();

		expect(
			await screen.findByText("UKMA Data зараз недоступний"),
		).toBeInTheDocument();
		expect(screen.getByText("Дані САЗ")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Відкрити синхронізацію" }),
		).toHaveAttribute("href", "/data/sync");
	});
});
