import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import MockAdapter from "axios-mock-adapter";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authorizedHttpClient } from "@/lib/api/apiClient";
import {
	CASES_URL,
	removalCase,
	serveCases,
	studentCase,
} from "./caseTestData";
import { ReviewCasePage } from "./ReviewCasePage";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", async () => ({
	Link: (await import("@/test-utils/router")).MockLink,
	useNavigate: () => navigate,
}));

const CASES = [studentCase(1), studentCase(2), removalCase];

let mock: MockAdapter;

function renderCase(caseId: string, search = "") {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	render(
		<QueryClientProvider client={queryClient}>
			<NuqsTestingAdapter searchParams={search}>
				<ReviewCasePage caseId={caseId} />
			</NuqsTestingAdapter>
		</QueryClientProvider>,
	);
}

beforeEach(() => {
	mock = new MockAdapter(authorizedHttpClient);
	serveCases(mock, CASES);
});

afterEach(() => {
	mock.restore();
	navigate.mockReset();
});

describe("case screen", () => {
	it("compares both sides, names the case in words and shows progress", async () => {
		// Arrange & Act
		renderCase("case-st-2");

		// Assert
		expect(
			await screen.findByRole("heading", {
				name: "Новий запис студента схожий на наявного",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("Справа 2 з 3")).toBeInTheDocument();
		expect(screen.getByRole("progressbar")).toHaveAttribute(
			"aria-valuenow",
			"67",
		);
		expect(screen.getByText("Запис із САЗ")).toBeInTheDocument();
		expect(screen.getByText("З ким зіставлено")).toBeInTheDocument();
		expect(screen.getByText("2 наявні студенти")).toBeInTheDocument();
		expect(
			screen.getByText("Що означає кожне рішення в сервісі даних САЗ:"),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Поки рішення немає, запис приєднано до найближчого наявного студента.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(
				"Рішення ухвалюють у сервісі даних САЗ, не на цьому сайті. Тут видно, що сталося і що показано студентам тим часом.",
			),
		).toBeInTheDocument();
		expect(
			screen.getByText(/Якщо це різні люди — залиште справу відкритою/),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Та сама людина/ })).toBeNull();
		expect(
			screen.getByText("Технічні деталі").closest("details"),
		).not.toHaveAttribute("open");
		expect(screen.getByRole("heading", { level: 2 })).not.toHaveTextContent(
			"case-",
		);
	});

	it("moves with the arrow keys and goes back on Escape", async () => {
		// Arrange
		renderCase("case-st-2");
		await screen.findByText("Справа 2 з 3");

		// Act
		fireEvent.keyDown(document, { key: "ArrowRight" });
		fireEvent.keyDown(document, { key: "ArrowLeft" });
		fireEvent.keyDown(document, { key: "Escape" });

		// Assert
		expect(navigate.mock.calls.map(([call]) => call)).toEqual([
			expect.objectContaining({ params: { caseId: "case-rm-1" } }),
			expect.objectContaining({ params: { caseId: "case-st-1" } }),
			expect.objectContaining({ to: "/data/cases" }),
		]);
	});

	it("disables «Попередня» on the first case", async () => {
		// Arrange & Act
		renderCase("case-st-1");

		// Assert
		expect(
			await screen.findByRole("button", { name: /Попередня/ }),
		).toBeDisabled();
		fireEvent.click(screen.getByRole("button", { name: /Наступна/ }));
		expect(navigate).toHaveBeenCalledWith(
			expect.objectContaining({ params: { caseId: "case-st-2" } }),
		);
	});

	it("counts progress within the list's filters", async () => {
		// Arrange & Act
		renderCase("case-rm-1", "?kind=removals_held");

		// Assert
		expect(await screen.findByText("Справа 1 з 1")).toBeInTheDocument();
		expect(
			screen.getByRole("heading", {
				name: "САЗ більше не показує 3 семестри 2029–2030",
			}),
		).toBeInTheDocument();
		expect(screen.getByText("Прибрати")).toBeInTheDocument();
	});

	it("says a case was not found and links back to the same list page", async () => {
		// Arrange & Act
		renderCase("case-missing", "?status=decided&page=2");

		// Assert
		expect(await screen.findByText("Справи не знайдено")).toBeInTheDocument();
		const back = screen.getByRole("link", { name: "До списку справ" });
		expect(back).toHaveAttribute("href", "/data/cases");
		expect(back).toHaveAttribute(
			"data-search",
			JSON.stringify({ kind: "all", status: "decided", q: "", page: 2 }),
		);
	});

	it("keeps the list page and filters when moving between cases", async () => {
		// Arrange
		renderCase("case-st-1", "?status=open&page=2&q=sem");
		await screen.findByRole("button", { name: /Наступна/ });

		// Act
		fireEvent.keyDown(document, { key: "Escape" });

		// Assert
		expect(navigate).toHaveBeenCalledWith({
			to: "/data/cases",
			search: { kind: "all", status: "open", q: "sem", page: 2 },
		});
	});

	it("opens a case outside the list's filters from the whole list", async () => {
		// Arrange
		serveCases(mock, [...CASES, studentCase(9, { status: "decided" })]);

		// Act
		renderCase("case-st-9", "?status=open");

		// Assert
		expect(await screen.findByText("Справа 4 з 4")).toBeInTheDocument();
	});

	it("shows the error with retry", async () => {
		// Arrange
		mock.onGet(CASES_URL).reply(500);

		// Act
		renderCase("case-st-1");

		// Assert
		expect(
			await screen.findByText("Не вдалося відкрити справу"),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "Спробувати знову" }),
		).toBeInTheDocument();
	});
});
