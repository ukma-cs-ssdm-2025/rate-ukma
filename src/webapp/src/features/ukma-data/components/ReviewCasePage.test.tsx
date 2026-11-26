import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import type { UkmaDataReviewCase } from "@/lib/api/generated";
import {
	CASES_URL,
	keyStatus,
	keyStatusWithDecide,
	STATUS_URL,
} from "@/features/ukma-data/components/dataTestData";
import { ReviewCasePage } from "@/features/ukma-data/components/ReviewCasePage";

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
	useNavigate: () => vi.fn(),
}));

const DECIDE_URL = "/api/v1/ukma-data/review-cases/rc-101/decide/";
const CASE_URL = "/api/v1/ukma-data/review-cases/rc-101/";

const person = {
	student_id: "s-1",
	record_id: "rec-1",
	first_name: "Олена",
	last_name: "Коваль",
	middle_name: "Петрівна",
	programme: "Тестова програма",
	study_year: 1,
	status: "active",
} as const;

const studentPeople = {
	id: "rc-101",
	kind: "student_match",
	status: "open",
	opened_at: "2030-09-01T08:00:00Z",
	record: person,
	joined_student_id: "s-2",
	candidates: [
		{ ...person, student_id: "s-2", middle_name: "Іванівна" },
		{ ...person, student_id: "s-3" },
	],
};

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

const page = (items: UkmaDataReviewCase[]) => ({
	items,
	cursor: 0,
	has_more: false,
	data_updated_at: "2030-09-10T06:10:00Z",
	total: items.length,
});

let mock: MockAdapter;

function renderCase(caseId = "rc-101") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams="" hasMemory>
				<ReviewCasePage caseId={caseId} />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	mock = new MockAdapter(authorizedHttpClient);
	mock.onGet(STATUS_URL).reply(200, keyStatus);
});

afterEach(() => {
	mock.restore();
	vi.clearAllMocks();
});

describe("/data/cases/$caseId", () => {
	it("shows the record and each matching student side by side", async () => {
		mock.onGet(CASES_URL).reply(200, page([studentCase]));
		mock.onGet(CASE_URL).reply(200, studentPeople);

		renderCase();

		expect(
			await screen.findByRole("heading", {
				name: "Новий запис студента схожий на наявного",
			}),
		).toBeInTheDocument();
		expect(await screen.findAllByText("Коваль Олена Петрівна")).toHaveLength(2);
		expect(screen.getByText("Коваль Олена Іванівна")).toHaveClass(
			"bg-tint-caution",
		);
		expect(screen.getByText("Приєднано зараз")).toBeInTheDocument();
		expect(screen.getByText(/Справа 1 з 1/)).toBeInTheDocument();
		expect(screen.getByText("Що означає кожне рішення:")).toBeInTheDocument();
	});

	it("keeps the case readable when the names do not load", async () => {
		mock.onGet(CASES_URL).reply(200, page([studentCase]));
		mock.onGet(CASE_URL).reply(502, { detail: "down" });

		renderCase();

		expect(
			await screen.findByText("Запис про навчання студента"),
		).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent(
			"Імена зараз не завантажились",
		);
		expect(screen.getByText(/2 наявні студенти/)).toBeInTheDocument();
	});

	it("says when the case is gone", async () => {
		mock.onGet(CASES_URL).reply(200, page([]));

		renderCase();

		expect(await screen.findByText("Справу не знайдено")).toBeInTheDocument();
	});

	it("decides the case after a confirm and shows the result", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply(200, page([studentCase]));
		mock.onPost(DECIDE_URL).reply(200, {
			decision_id: 41,
			action: "decide_case",
			outcome: "done",
			detail: "Справу закрито: це та сама людина.",
		});

		renderCase();

		await user.click(
			await screen.findByRole("button", { name: "Це та сама людина" }),
		);
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Закрити справу",
			}),
		);

		expect(
			await screen.findByText("Справу закрито: це та сама людина."),
		).toBeInTheDocument();
		expect(mock.history.post).toHaveLength(1);
	});

	it("keeps the result on screen while the decided case reloads", async () => {
		// Arrange
		const user = userEvent.setup();
		let decided = false;
		let releaseAll = () => {};
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply((config) => {
			if (!decided) {
				return [200, page([studentCase])];
			}
			if (config.params?.status === "open") {
				return [200, page([])];
			}
			return new Promise((resolve) => {
				releaseAll = () =>
					resolve([200, page([{ ...studentCase, status: "decided" }])]);
			});
		});
		mock.onPost(DECIDE_URL).reply(() => {
			decided = true;
			return [
				200,
				{
					decision_id: 41,
					action: "decide_case",
					outcome: "done",
					detail: "Справу закрито: це та сама людина.",
				},
			];
		});

		// Act
		renderCase();
		await user.click(
			await screen.findByRole("button", { name: "Це та сама людина" }),
		);
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Закрити справу",
			}),
		);
		await waitFor(() =>
			expect(
				mock.history.get.filter(
					(request) =>
						request.url === CASES_URL && request.params?.status !== "open",
				),
			).toHaveLength(1),
		);

		// Assert
		expect(
			screen.getByText("Справу закрито: це та сама людина."),
		).toBeInTheDocument();
		releaseAll();
		expect(
			await screen.findByText("Справу закрито: це та сама людина."),
		).toBeInTheDocument();
	});

	it("does not keep a stale case when the reload fails", async () => {
		// Arrange
		const user = userEvent.setup();
		let decided = false;
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply((config) => {
			if (!decided) {
				return [200, page([studentCase])];
			}
			return config.params?.status === "open"
				? [200, page([])]
				: [500, { detail: "boom", status: 500 }];
		});
		mock.onPost(DECIDE_URL).reply(() => {
			decided = true;
			return [
				200,
				{
					decision_id: 41,
					action: "decide_case",
					outcome: "done",
					detail: "Справу закрито: це та сама людина.",
				},
			];
		});

		// Act
		renderCase();
		await user.click(
			await screen.findByRole("button", { name: "Це та сама людина" }),
		);
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Закрити справу",
			}),
		);

		// Assert
		expect(
			await screen.findByText("Не вдалося завантажити справу"),
		).toBeInTheDocument();
		expect(
			screen.queryByRole("button", { name: "Це та сама людина" }),
		).not.toBeInTheDocument();
	});
});
