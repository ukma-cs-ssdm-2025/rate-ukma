import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import { createMockFilterOptions } from "@/test-utils/factories";
import { render, screen, within } from "@/test-utils/render";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { CourseFiltersPanel } from "./CourseFiltersPanel";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import {
	CREDITS_RANGE,
	DIFFICULTY_RANGE,
	USEFULNESS_RANGE,
} from "../courseFormatting";

const DEFAULT_PARAMS: CourseFiltersParamsState = {
	q: "",
	diff: DIFFICULTY_RANGE,
	use: USEFULNESS_RANGE,
	faculty: "",
	dept: "",
	instructor: "",
	term: [],
	year: "",
	credits: CREDITS_RANGE,
	type: null,
	spec: "",
	eduLevel: null,
	page: 1,
	size: 10,
	diffOrder: null,
	useOrder: null,
	reviewSort: null,
};

function assertElement(
	element: Element | null | undefined,
	message: string,
): HTMLElement {
	if (!element) {
		throw new Error(message);
	}
	return element as HTMLElement;
}

const defaultOnReset = vi.fn();
const defaultSetParams = vi.fn();

function TestWrapper({
	onReset = defaultOnReset,
	filterOptions = createMockFilterOptions(),
	initialParams = DEFAULT_PARAMS,
	setParams = defaultSetParams,
}: Readonly<{
	onReset?: () => void;
	filterOptions?: ReturnType<typeof createMockFilterOptions>;
	initialParams?: CourseFiltersParamsState;
	setParams?: (updates: Partial<CourseFiltersParamsState>) => void;
}>) {
	return (
		<CourseFiltersPanel
			params={initialParams}
			setParams={setParams}
			filterOptions={filterOptions}
			onReset={onReset}
		/>
	);
}

describe("CourseFiltersPanel", () => {
	describe("Rendering", () => {
		it("should render filter panel with title", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText("Фільтри")).toBeInTheDocument();
		});

		it("should render skeleton when loading", () => {
			// Act
			render(
				<CourseFiltersPanel
					params={DEFAULT_PARAMS}
					setParams={vi.fn()}
					filterOptions={undefined}
					onReset={vi.fn()}
					isLoading={true}
				/>,
			);

			// Assert
			expect(screen.queryByText("Фільтри")).not.toBeInTheDocument();
		});

		it("should render all range filters", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText("Складність")).toBeInTheDocument();
			expect(screen.getByText("Корисність")).toBeInTheDocument();
		});

		it("should render all filter section headers", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText("Оцінки")).toBeInTheDocument();
			expect(screen.getByText("Семестр")).toBeInTheDocument();
			expect(screen.getByText("Навчання")).toBeInTheDocument();
			expect(screen.getByText("Більше фільтрів")).toBeInTheDocument();
		});

		it("should render filter presets", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText("Легкі курси")).toBeInTheDocument();
			expect(screen.getByText("Найкорисніші")).toBeInTheDocument();
		});
	});

	describe("Range Filter Interactions", () => {
		it("should display current difficulty range values", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialParams={{
						...DEFAULT_PARAMS,
						diff: [2.5, 4.5],
					}}
				/>,
			);

			// Assert
			expect(screen.getByText("2.5–4.5")).toBeInTheDocument();
		});

		it("should display current usefulness range values", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialParams={{
						...DEFAULT_PARAMS,
						use: [3, 5],
					}}
				/>,
			);

			// Assert
			expect(screen.getByText("3–5")).toBeInTheDocument();
		});

		it("should display credits value readout", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialParams={{
						...DEFAULT_PARAMS,
						year: "2024",
						credits: [4, 5.5],
					}}
				/>,
			);

			// Assert
			expect(screen.getByText("Кредити ECTS")).toBeInTheDocument();
			expect(screen.getByText(/4.*5\.5/)).toBeInTheDocument();
		});
	});

	describe("Select Filter Interactions", () => {
		it("should render faculty select with options when structure expanded", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "fac-1",
						name: "Факультет інформатики",
						departments: [],
						specialities: [],
					},
					{
						id: "fac-2",
						name: "Факультет економічних наук",
						departments: [],
						specialities: [],
					},
				],
			});

			// Act — essentials are always visible
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			const facultyLabel = screen.getByText("Факультет");
			expect(facultyLabel).toBeInTheDocument();
			const selectContainer = assertElement(
				facultyLabel.closest(".space-y-2"),
				"Faculty select container not found",
			);
			const facultySelect = within(selectContainer).getByRole("combobox");
			expect(facultySelect).toBeInTheDocument();
			expect(facultySelect).not.toBeDisabled();
		});

		it("should render one toggle per term option in FALL, SPRING, SUMMER order", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				semester_terms: [
					{ value: "SUMMER", label: "Літо" },
					{ value: "FALL", label: "Осінь" },
					{ value: "SPRING", label: "Весна" },
				],
			});

			// Act — essentials are always visible
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			const toggleGroup = screen.getByTestId(testIds.filters.termToggle);
			expect(toggleGroup).toBeInTheDocument();
			expect(toggleGroup).toHaveAttribute("role", "group");

			const toggleButtons = within(toggleGroup).getAllByRole("button");
			expect(toggleButtons).toHaveLength(3);
			expect(toggleButtons[0]).toHaveTextContent("Осінь");
			expect(toggleButtons[1]).toHaveTextContent("Весна");
			expect(toggleButtons[2]).toHaveTextContent("Літо");
		});

		it("should disable credits slider when year is not selected", () => {
			// Act — credits live in the disclosure, mounted via forceMount
			render(<TestWrapper />);

			// Assert
			expect(screen.getByTestId(testIds.filters.creditsSelect)).toHaveAttribute(
				"data-disabled",
				"",
			);
		});

		it("should show the year hint under credits until a year is selected", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(
				screen.getByText("Спочатку оберіть навчальний рік"),
			).toBeInTheDocument();
		});

		it("should auto-open the disclosure when a filter inside is active", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialParams={{
						...DEFAULT_PARAMS,
						instructor: "instructor-1",
					}}
				/>,
			);

			// Assert
			expect(screen.getByText("Більше фільтрів")).toBeInTheDocument();
			expect(
				screen.getByTestId(testIds.filters.instructorSelect),
			).toBeVisible();
		});
	});

	describe("Reset Functionality", () => {
		it("should show reset button when filters are active", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialParams={{
						...DEFAULT_PARAMS,
						q: "Test",
					}}
				/>,
			);

			// Assert
			expect(
				screen.getByRole("button", { name: /скинути/i }),
			).toBeInTheDocument();
		});

		it("should not show reset button when no filters are active", () => {
			// Arrange & Act
			render(<TestWrapper initialParams={DEFAULT_PARAMS} />);

			// Assert
			expect(
				screen.queryByRole("button", { name: /скинути/i }),
			).not.toBeInTheDocument();
		});

		it("should call onReset when reset button is clicked", async () => {
			// Arrange
			const user = userEvent.setup();
			const onReset = vi.fn();
			render(
				<TestWrapper
					initialParams={{
						...DEFAULT_PARAMS,
						q: "Test",
					}}
					onReset={onReset}
				/>,
			);

			// Act
			const resetButton = screen.getByRole("button", { name: /скинути/i });
			await user.click(resetButton);

			// Assert
			expect(onReset).toHaveBeenCalledTimes(1);
		});
	});

	describe("Department Cascading Logic", () => {
		it("should render department select when structure group expanded", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "fac-1",
						name: "Факультет інформатики",
						departments: [
							{
								id: "dept-1",
								name: "Кафедра програмування",
							},
						],
						specialities: [],
					},
				],
			});

			// Act — essentials are always visible
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			const deptLabel = screen.getByText("Кафедра");
			expect(deptLabel).toBeInTheDocument();
			const selectContainer = assertElement(
				deptLabel.closest(".space-y-2"),
				"Department select container not found",
			);
			const deptSelect = within(selectContainer).getByRole("combobox");
			expect(deptSelect).toBeInTheDocument();
			expect(deptSelect).not.toBeDisabled();
		});
	});

	describe("Accessibility", () => {
		it("should have proper labels for range filters", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText("Складність")).toBeInTheDocument();
			expect(screen.getByText("Корисність")).toBeInTheDocument();
		});

		it("should have reset button with proper text", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialParams={{
						...DEFAULT_PARAMS,
						q: "Test",
					}}
				/>,
			);

			// Assert
			const resetButton = screen.getByRole("button", { name: /скинути/i });
			expect(resetButton).toHaveAttribute("type", "button");
		});
	});
});

describe("ActiveFilterChips", () => {
	it("should render null when no filter is active", () => {
		// Arrange & Act
		const { container } = render(
			<ActiveFilterChips
				params={DEFAULT_PARAMS}
				setParams={vi.fn()}
				filterOptions={createMockFilterOptions()}
				onReset={vi.fn()}
			/>,
		);

		// Assert
		expect(container).toBeEmptyDOMElement();
	});

	it("should render a removable chip per active filter plus a reset button", async () => {
		// Arrange
		const user = userEvent.setup();
		const setParams = vi.fn();
		const onReset = vi.fn();
		render(
			<ActiveFilterChips
				params={{
					...DEFAULT_PARAMS,
					diff: [1, 2.5],
					term: ["FALL"],
				}}
				setParams={setParams}
				filterOptions={createMockFilterOptions()}
				onReset={onReset}
			/>,
		);

		// Assert
		expect(screen.getByText("Складність 1–2.5")).toBeInTheDocument();
		expect(screen.getByText("Осінь")).toBeInTheDocument();

		// Act
		await user.click(
			screen.getByRole("button", { name: "Прибрати фільтр Осінь" }),
		);

		// Assert
		expect(setParams).toHaveBeenCalledWith({ term: [], page: 1 });
		await user.click(screen.getByRole("button", { name: "Скинути все" }));
		expect(onReset).toHaveBeenCalledTimes(1);
	});
});
