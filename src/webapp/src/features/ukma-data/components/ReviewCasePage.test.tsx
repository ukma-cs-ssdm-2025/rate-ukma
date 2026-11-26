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
const STUDENT_URL = "/api/v1/ukma-data/review-cases/rc-101/";

const person = (
	studentId: string,
	lastName: string,
	studyYear: number | null,
) => ({
	student_id: studentId,
	record_id: `pr-${studentId}`,
	first_name: "Тест",
	last_name: lastName,
	programme: "Тестова програма",
	study_year: studyYear,
	status: "active",
});

const studentDetails = {
	id: "rc-101",
	kind: "student_match",
	status: "open",
	opened_at: "2030-09-01T08:00:00Z",
	record: person("s-1", "Прикладенко", 1),
	joined_student_id: "s-2",
	candidates: [
		person("s-3", "Прикладенко", 1),
		person("s-2", "Вигаданенко", 3),
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
	mock.onGet(STUDENT_URL).reply(200, studentDetails);
});

afterEach(() => {
	mock.restore();
	vi.clearAllMocks();
});

describe("/data/cases/$caseId", () => {
	it("shows the case sides and its options", async () => {
		mock.onGet(CASES_URL).reply(200, page([studentCase]));

		renderCase();

		expect(
			await screen.findByRole("heading", {
				name: "Новий запис студента схожий на наявного",
			}),
		).toBeInTheDocument();
		expect(screen.getByText(/Справа 1 з 1/)).toBeInTheDocument();
		expect(
			screen.getByText("Що означає кожне рішення в сервісі даних САЗ:"),
		).toBeInTheDocument();
	});

	it("puts the record next to the student it joined, with what differs", async () => {
		mock.onGet(CASES_URL).reply(200, page([studentCase]));

		renderCase();

		const table = within(await screen.findByRole("table"));
		expect(
			table.getAllByRole("columnheader").map((cell) => cell.textContent),
		).toEqual([
			"Поле",
			"Новий запис із САЗ",
			"Приєднано до студента",
			"Ще схожий студент",
		]);
		const surname = table.getByRole("row", { name: /Прізвище/ });
		expect(
			within(surname)
				.getAllByRole("cell")
				.map((cell) => cell.textContent),
		).toEqual([
			"Прикладенко",
			"Вигаданенко (інакше, ніж у записі)",
			"Прикладенко",
		]);
		expect(
			screen.getByText("Відрізняється від запису: прізвище, рік навчання."),
		).toBeInTheDocument();
	});

	it("explains when the student details cannot be read", async () => {
		mock.onGet(CASES_URL).reply(200, page([studentCase]));
		mock.onGet(STUDENT_URL).reply(502, {
			detail: "UKMA Data answered 500.",
			code: "ukma_data_unavailable",
			status: 502,
		});

		renderCase();

		expect(
			await screen.findByText("Дані САЗ зараз недоступні"),
		).toBeInTheDocument();
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
