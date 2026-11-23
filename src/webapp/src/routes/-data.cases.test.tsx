import type { ComponentType } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
	keyStatusWithDecide,
	STATUS_URL,
} from "@/features/ukma-data/components/dataTestData";
import { READ_ONLY } from "@/features/ukma-data/reviewCases";
import { Route } from "./data.cases.index";

vi.mock("@tanstack/react-router", async () => ({
	createFileRoute: () => (options: object) => options,
	Link: (await import("@/test-utils/router")).MockLink,
}));

const DECIDE_URL = "/api/v1/ukma-data/review-cases/rc-101/decide/";
const MERGE_URL = "/api/v1/ukma-data/courses/c-201/merge/";

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

const decideRequests = () =>
	mock.history.post.filter((request) => request.url === DECIDE_URL);

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

		const table = await screen.findByRole("table");
		const rows = within(table).getAllByRole("row");
		expect(rows).toHaveLength(3);
		expect(rows[1]).toHaveTextContent(
			"Новий запис студента схожий на наявного",
		);
		expect(rows[1]).toHaveTextContent("Збігся з 2 студентами");
		expect(rows[1]).toHaveTextContent("Чекає рішення");
		expect(rows[2]).toHaveTextContent(
			"Семестр із САЗ схожий на кілька дисциплін",
		);
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

	it("disables every action with a tooltip when the decide key has no scope", async () => {
		const user = userEvent.setup();
		mock.onGet(CASES_URL).reply(200, casePage([studentCase]));

		renderCases();

		const button = await screen.findByRole("button", {
			name: "Це та сама людина",
		});
		expect(button).toBeDisabled();
		const wrapper = button.parentElement;
		expect(wrapper).not.toBeNull();
		await user.hover(wrapper as HTMLElement);
		expect(await screen.findByText(READ_ONLY)).toBeInTheDocument();
	});

	it("decides a student case after a confirm naming it", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply(200, casePage([studentCase]));
		mock.onPost(DECIDE_URL).reply(200, {
			decision_id: 41,
			action: "decide_case",
			outcome: "done",
			detail: "Справу закрито: це та сама людина.",
		});

		renderCases();

		await user.click(
			await screen.findByRole("button", { name: "Це та сама людина" }),
		);
		const dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveTextContent("Це та сама людина?");
		expect(dialog).toHaveTextContent("rc-101");
		expect(dialog).toHaveTextContent("Це змінює спільні дані САЗ");
		await user.click(
			within(dialog).getByRole("button", { name: "Закрити справу" }),
		);

		expect(
			await screen.findByText("Справу закрито: це та сама людина."),
		).toBeInTheDocument();
		await waitFor(() => expect(decideRequests()).toHaveLength(1));
	});

	it("merges a course into the chosen candidate", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply(200, casePage([courseCase]));
		mock.onPost(MERGE_URL).reply(200, {
			decision_id: 42,
			action: "merge_course",
			outcome: "done",
			detail: "Курс об'єднано.",
		});

		renderCases();

		await user.click(
			await screen.findByRole("button", { name: "Об'єднати з c-202" }),
		);
		const dialog = await screen.findByRole("alertdialog");
		expect(dialog).toHaveTextContent(
			"Об'єднати семестр c-201 з дисципліною c-202?",
		);
		await user.click(within(dialog).getByRole("button", { name: "Об'єднати" }));

		expect(await screen.findByText("Курс об'єднано.")).toBeInTheDocument();
		await waitFor(() => expect(mock.history.post).toHaveLength(1));
		expect(JSON.parse(String(mock.history.post[0].data))).toEqual({
			into: "c-202",
		});
	});

	it("shows a 409 refusal with the server's Ukrainian detail", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply(200, casePage([courseCase]));
		mock.onPost(MERGE_URL).reply(409, {
			detail: "Курси різного рівня: об'єднати можна лише однакові.",
			code: "ukma_data_refused",
			status: 409,
		});

		renderCases();

		await user.click(
			await screen.findByRole("button", { name: "Об'єднати з c-203" }),
		);
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Об'єднати",
			}),
		);

		expect(
			await screen.findByText(
				"Курси різного рівня: об'єднати можна лише однакові.",
			),
		).toBeInTheDocument();
	});

	it("shows a 403 ukma_data_forbidden detail", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply(200, casePage([studentCase]));
		mock.onPost(DECIDE_URL).reply(403, {
			detail: READ_ONLY,
			code: "ukma_data_forbidden",
			status: 403,
		});

		renderCases();

		await user.click(
			await screen.findByRole("button", { name: "Це та сама людина" }),
		);
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Закрити справу",
			}),
		);

		expect(await screen.findByText(READ_ONLY)).toBeInTheDocument();
	});

	it("sends nothing when the confirm is cancelled", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply(200, casePage([studentCase]));

		renderCases();

		await user.click(
			await screen.findByRole("button", { name: "Це та сама людина" }),
		);
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Скасувати",
			}),
		);

		await waitFor(() =>
			expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
		);
		expect(mock.history.post).toHaveLength(0);
	});
});
