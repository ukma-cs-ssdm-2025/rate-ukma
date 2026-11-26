import type { ComponentType } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import type {
	UkmaDataReviewCase,
	UkmaDataReviewCasePage,
} from "@/lib/api/generated";
import {
	CASES_URL,
	keyStatus,
	STATUS_URL,
} from "@/features/ukma-data/components/dataTestData";
import { Route } from "./data.cases.index";

vi.mock("@tanstack/react-router", async () => ({
	createFileRoute: () => (options: object) => options,
	Link: (await import("@/test-utils/router")).MockLink,
}));

const studentCase: UkmaDataReviewCase = {
	id: "rc-101",
	kind: "student_match",
	subject_id: "s-1",
	candidates: ["s-2", "s-3"],
	safe_answer: null,
	status: "open",
	run_id: "r-1",
	decision_id: null,
	opened_at: "2030-09-01T08:00:00Z",
	change_no: 6,
};

const courseCase: UkmaDataReviewCase = {
	id: "rc-201",
	kind: "course_match",
	subject_id: "c-201",
	candidates: ["c-202", "c-203"],
	safe_answer: null,
	status: "open",
	run_id: "r-1",
	decision_id: null,
	opened_at: "2030-09-01T09:00:00Z",
	change_no: 7,
};

const casePage = (items: UkmaDataReviewCase[]): UkmaDataReviewCasePage => ({
	items,
	cursor: items.at(-1)?.change_no ?? 0,
	has_more: false,
	data_updated_at: "2030-09-10T06:10:00Z",
	total: items.length,
});

const ReviewCases = (Route as unknown as { component: ComponentType })
	.component;

let mock: MockAdapter;

function renderCases(search = "") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams={search} hasMemory>
				<ReviewCases />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
	return queryClient;
}

beforeEach(() => {
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(STATUS_URL).reply(200, keyStatus);
});

afterEach(() => {
	mock.restore();
	vi.clearAllMocks();
});

describe("/data/cases", () => {
	it("lists open cases in words with their state", async () => {
		mock.onGet(CASES_URL).reply(200, casePage([studentCase, courseCase]));

		renderCases();

		const list = await screen.findByRole("list", { name: "Справи UKMA Data" });
		const rows = within(list).getAllByRole("listitem");
		expect(rows).toHaveLength(2);
		expect(rows[0]).toHaveTextContent(
			"Новий запис студента схожий на наявного",
		);
		expect(rows[0]).toHaveTextContent("Збігся з 2 студентами");
		expect(rows[0]).toHaveTextContent("Чекає рішення");
		expect(rows[1]).toHaveTextContent(
			"Семестр із САЗ схожий на кілька дисциплін",
		);
		expect(screen.queryByRole("button", { name: /та сама людина/ })).toBeNull();
		const listCall = mock.history.get.find(
			(request) => request.url === CASES_URL,
		);
		expect(listCall?.params).toMatchObject({
			limit: 1000,
			status: "open",
		});
		expect(screen.getByText(/2 справи чекають рішення/)).toBeInTheDocument();
	});

	it("says when nothing waits behind the filter", async () => {
		mock.onGet(CASES_URL).reply(200, casePage([]));

		renderCases();

		expect(
			await screen.findByText("За цим фільтром справ немає"),
		).toBeInTheDocument();
	});
});
