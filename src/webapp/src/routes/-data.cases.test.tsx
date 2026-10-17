import type { ComponentType } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	getAuthSessionRetrieveQueryKey,
	type UkmaDataReviewCasePage,
} from "@/lib/api/generated";
import { notifySessionExpired } from "@/lib/auth/sessionExpiry";
import { Route } from "./data.cases.index";

vi.mock("@tanstack/react-router", async () => ({
	createFileRoute: () => (options: object) => options,
	Link: (await import("@/test-utils/router")).MockLink,
}));

vi.mock("@/lib/auth/sessionExpiry", () => ({
	notifySessionExpired: vi.fn(),
}));

const URL = "/api/v1/ukma-data/review-cases/";

const PAGE: UkmaDataReviewCasePage = {
	items: [
		{
			id: "case-1",
			kind: "course_match",
			subject_id: "off-test-1",
			candidates: ["off-test-2"],
			safe_answer: { course: "new" },
			status: "open",
			run_id: "run-7",
			decision_id: null,
			opened_at: "2030-09-01T10:00:00Z",
			change_no: 11,
		},
		{
			id: "case-2",
			kind: "removals_held",
			subject_id: "run-6",
			candidates: [],
			safe_answer: null,
			status: "decided",
			run_id: "run-6",
			decision_id: "dec-1",
			opened_at: "2030-08-01T10:00:00Z",
			change_no: 12,
		},
	],
	cursor: 12,
	has_more: false,
	data_updated_at: "2030-09-01T09:00:00Z",
};

const ReviewCases = (Route as unknown as { component: ComponentType })
	.component;

let mockAxios: MockAdapter;

function renderCases(search = "?status=all") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	const invalidate = vi.spyOn(queryClient, "invalidateQueries");
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams={search}>
				<ReviewCases />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
	return { invalidate };
}

beforeEach(() => {
	mockAxios = new MockAdapter(authorizedHttpClient);
});

afterEach(() => {
	mockAxios.restore();
	vi.clearAllMocks();
});

describe("/data/cases", () => {
	it("lists the review cases the proxy returns", async () => {
		mockAxios.onGet(URL).reply(200, PAGE);

		renderCases();

		const items = await screen.findAllByRole("listitem");
		expect(items).toHaveLength(2);
		expect(items[0]).toHaveTextContent("Збіг курсу");
		expect(items[0]).toHaveTextContent("Обʼєкт off-test-1");
		expect(items[0]).toHaveTextContent("запуск run-7");
		expect(items[1]).toHaveTextContent("Вирішена");
		expect(mockAxios.history.get[0].params).toEqual({ limit: 1000 });
	});

	it("filters the page by status in the URL", async () => {
		mockAxios.onGet(URL).reply(200, PAGE);

		renderCases("?status=open");

		const items = await screen.findAllByRole("listitem");
		expect(items).toHaveLength(1);
		expect(items[0]).toHaveTextContent("off-test-1");
	});

	it("says UKMA Data is down on 502", async () => {
		mockAxios.onGet(URL).reply(502, { detail: "x", status: 502 });

		renderCases();

		expect(
			await screen.findByText("UKMA Data зараз недоступний"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Спробувати знову" }),
		).toBeInTheDocument();
	});

	it("says UKMA Data is not configured on 503", async () => {
		mockAxios.onGet(URL).reply(503, { detail: "x", status: 503 });

		renderCases();

		expect(
			await screen.findByText("UKMA Data не налаштовано"),
		).toBeInTheDocument();
	});

	it("shows the superusers-only page on 403 and keeps the user signed in", async () => {
		mockAxios.onGet(URL).reply(403, { detail: "x", status: 403 });

		const { invalidate } = renderCases();

		expect(
			await screen.findByText("Розділ лише для суперкористувачів"),
		).toBeInTheDocument();
		expect(notifySessionExpired).not.toHaveBeenCalled();
		expect(invalidate).toHaveBeenCalledWith({
			queryKey: getAuthSessionRetrieveQueryKey(),
		});
	});
});
