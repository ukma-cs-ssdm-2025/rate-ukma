import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import type { UkmaDataStatus } from "@/lib/api/generated";
import { OverviewPage } from "./OverviewPage";

vi.mock("@tanstack/react-router", async () => ({
	...(await vi.importActual("@tanstack/react-router")),
	Link: (await import("@/test-utils/router")).MockLink,
}));

const status: UkmaDataStatus = {
	key_id: "key-test",
	scopes: ["catalog:read"],
	key_expires_at: "2031-01-01T00:00:00Z",
	data_updated_at: "2030-09-01T00:10:00Z",
};

let mockAxios: MockAdapter;

function renderPage() {
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
	mockAxios.onGet("/api/v1/ukma-data/status/").reply(200, status);
});

afterEach(() => {
	mockAxios.restore();
});

describe("UKMA Data overview", () => {
	it("says the server key cannot read open cases instead of superusers-only", async () => {
		// Arrange
		mockAxios.onGet("/api/v1/ukma-data/review-cases/").reply(403, {
			detail: "UKMA Data refused the key",
			status: 403,
			code: "ukma_data_forbidden",
		});

		// Act
		renderPage();

		// Assert
		const title = await screen.findByText(
			"Немає доступу до цих даних UKMA Data",
		);
		const card =
			title.closest<HTMLElement>("[data-slot='card']") ?? document.body;
		expect(within(card).getByText("Відкриті справи")).toBeInTheDocument();
		expect(
			screen.getByText(
				"Ключ UKMA Data цього сервера не має доступу до цього розділу. Інші розділи працюють.",
			),
		).toBeInTheDocument();
		expect(screen.queryByText("Розділ лише для суперкористувачів")).toBeNull();
	});
});
