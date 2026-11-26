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
import { READ_ONLY } from "@/features/ukma-data/reviewCases";

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
	middle_name: "Тестович",
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

const RECORDS_URL = "/api/v1/ukma-data/records/";
const MERGE_URL = "/api/v1/ukma-data/courses/ud-new/merge/";

const record = (id: string, title: string, extra: object = {}) => ({
	id,
	kind: "course",
	title,
	place: "Кафедра прикладів",
	semester: null,
	ratings: 0,
	course_id: null,
	on_site: true,
	...extra,
});

const courseCase: UkmaDataReviewCase = {
	...studentCase,
	id: "rc-201",
	kind: "course_match",
	subject_id: "ud-new",
	candidates: ["ud-old"],
};

const removalsCase: UkmaDataReviewCase = {
	...studentCase,
	id: "rc-301",
	kind: "removals_held",
	subject_id: "2030",
	candidates: { academicYear: 2030, offerings: ["ud-o1", "ud-o2"] },
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
			screen.getByText("Що означає кожне рішення в UKMA Data:"),
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

	it("names the disciplines of a course case and merges by name", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply(200, page([courseCase]));
		mock.onGet(RECORDS_URL).reply(200, {
			items: [
				record("ud-new", "Тестова дисципліна Б", { on_site: false }),
				record("ud-old", "Тестова дисципліна А", { ratings: 7 }),
			],
		});
		mock.onPost(MERGE_URL).reply(200, {
			decision_id: 42,
			action: "merge_course",
			outcome: "done",
			detail: "Дисципліну об'єднано.",
		});

		renderCase("rc-201");

		const list = within(
			await screen.findByRole("list", { name: "Схожі дисципліни" }),
		);
		expect(list.getByText("Тестова дисципліна А")).toBeInTheDocument();
		expect(list.getByText("7 оцінок")).toBeInTheDocument();
		await user.click(
			screen.getByRole("button", {
				name: "Об'єднати з «Тестова дисципліна А»",
			}),
		);
		const dialog = within(await screen.findByRole("alertdialog"));
		expect(
			dialog.getByText(
				"Об'єднати «Тестова дисципліна Б» з «Тестова дисципліна А»?",
			),
		).toBeInTheDocument();
		await user.click(dialog.getByRole("button", { name: "Об'єднати" }));
		expect(
			await screen.findByText("Дисципліну об'єднано."),
		).toBeInTheDocument();
		expect(JSON.parse(mock.history.post[0]?.data as string)).toEqual({
			into: "ud-old",
		});
	});

	it("lists the semesters a removals case holds and says where to decide", async () => {
		mock.onGet(CASES_URL).reply(200, page([removalsCase]));
		mock.onGet(RECORDS_URL).reply(200, {
			items: [
				record("ud-o1", "Тестова дисципліна А", {
					kind: "offering",
					semester: "Осінь 2030",
					ratings: 2,
				}),
				record("ud-o2", "Тестова дисципліна Б", {
					kind: "offering",
					semester: "Весна 2031",
				}),
			],
		});

		renderCase("rc-301");

		expect(
			await screen.findByText(
				"2 семестри навчального року 2030–2031, на 1 з них є оцінки.",
			),
		).toBeInTheDocument();
		expect(screen.getByText("Осінь 2030")).toBeInTheDocument();
		expect(screen.getByText(/лише в самій UKMA Data/)).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Прибрати/ })).toBeNull();
	});

	it("disables decisions with a tooltip when the server key lacks review:decide", async () => {
		const user = userEvent.setup();
		mock.onGet(CASES_URL).reply(200, page([studentCase]));

		renderCase();

		const button = await screen.findByRole("button", {
			name: "Це та сама людина",
		});
		expect(button).toBeDisabled();
		await user.hover(button.parentElement as HTMLElement);
		expect(await screen.findByText(READ_ONLY)).toBeInTheDocument();
	});

	it("shows a 409 refusal with the server's Ukrainian detail", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(CASES_URL).reply(200, page([courseCase]));
		mock.onGet(RECORDS_URL).reply(200, {
			items: [
				record("ud-new", "Тестова дисципліна Б"),
				record("ud-old", "Тестова дисципліна А"),
			],
		});
		mock.onPost(MERGE_URL).reply(409, {
			detail: "Дисципліни різного рівня: об'єднати можна лише однакові.",
			code: "ukma_data_refused",
			status: 409,
		});

		renderCase("rc-201");
		await user.click(
			await screen.findByRole("button", {
				name: "Об'єднати з «Тестова дисципліна А»",
			}),
		);
		await user.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Об'єднати",
			}),
		);

		expect(
			await screen.findByText(
				"Дисципліни різного рівня: об'єднати можна лише однакові.",
			),
		).toBeInTheDocument();
	});

	it("shows a 403 ukma_data_forbidden detail", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(STUDENT_URL).reply(200, studentDetails);
		mock.onGet(CASES_URL).reply(200, page([studentCase]));
		mock.onPost(DECIDE_URL).reply(403, {
			detail: READ_ONLY,
			code: "ukma_data_forbidden",
			status: 403,
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

		expect(await screen.findByText(READ_ONLY)).toBeInTheDocument();
	});

	it("sends nothing when the confirm is cancelled", async () => {
		const user = userEvent.setup();
		mock.reset();
		mock.onGet(STATUS_URL).reply(200, keyStatusWithDecide);
		mock.onGet(STUDENT_URL).reply(200, studentDetails);
		mock.onGet(CASES_URL).reply(200, page([studentCase]));

		renderCase();
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
