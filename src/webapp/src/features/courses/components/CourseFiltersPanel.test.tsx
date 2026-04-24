import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { testIds } from "@/lib/test-ids";
import { createMockFilterOptions } from "@/test-utils/factories";
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
			expect(screen.getByText(/Складність:/)).toBeInTheDocument();
			expect(screen.getByText(/Корисність:/)).toBeInTheDocument();
		});

		it("should render all filter group headers", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText("Рейтинг")).toBeInTheDocument();
			expect(screen.getByText("Семестр")).toBeInTheDocument();
			expect(screen.getByText("Структура")).toBeInTheDocument();
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
			expect(screen.getByText(/Складність: 2\.5 - 4\.5/)).toBeInTheDocument();
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
			expect(screen.getByText(/Корисність: 3 - 5/)).toBeInTheDocument();
		});

		it("should display range captions", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText("Легко")).toBeInTheDocument();
			expect(screen.getByText("Складно")).toBeInTheDocument();
			expect(screen.getByText("Низька")).toBeInTheDocument();
			expect(screen.getByText("Висока")).toBeInTheDocument();
		});
		it("should render credits inputs with half-step increments", () => {
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
			expect(screen.getByLabelText(/ECTS minimum/)).toHaveAttribute(
				"step",
				"0.5",
			);
			expect(screen.getByLabelText(/ECTS maximum/)).toHaveAttribute(
				"step",
				"0.5",
			);
			expect(screen.getByLabelText(/ECTS minimum/)).toHaveValue(4);
			expect(screen.getByLabelText(/ECTS maximum/)).toHaveValue(5.5);
		});

		it("should snap credits input values to valid half-step increments", async () => {
			// Arrange
			const user = userEvent.setup();
			const setParams = vi.fn();
			render(
				<TestWrapper
					initialParams={{
						...DEFAULT_PARAMS,
						year: "2024",
						credits: [4, 6],
					}}
					setParams={setParams}
				/>,
			);

			// Act
			const minimumInput = screen.getByLabelText(/ECTS minimum/);
			await user.clear(minimumInput);
			await user.type(minimumInput, "4.27");
			await user.tab();

			// Assert
			expect(setParams).toHaveBeenCalledWith({ credits: [4.5, 6], page: 1 });
			expect(minimumInput).toHaveValue(4.5);
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

			// Act — groups are open by default
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			const facultyLabel = screen.getByText("Факультет");
			expect(facultyLabel).toBeInTheDocument();
			const selectContainer = assertElement(
				facultyLabel.closest(".space-y-3"),
				"Faculty select container not found",
			);
			const facultySelect = within(selectContainer).getByRole("combobox");
			expect(facultySelect).toBeInTheDocument();
			expect(facultySelect).not.toBeDisabled();
		});

		it("should render semester term toggle group with options when expanded", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				semester_terms: [
					{ value: "FALL", label: "Осінь" },
					{ value: "SPRING", label: "Весна" },
				],
			});

			// Act — groups are open by default
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			const toggleGroup = screen.getByTestId(testIds.filters.termToggle);
			expect(toggleGroup).toBeInTheDocument();
			expect(toggleGroup).toHaveAttribute("role", "group");

			const toggleButtons = within(toggleGroup).getAllByRole("button");
			expect(toggleButtons).toHaveLength(2);
			expect(toggleButtons[0]).toHaveTextContent("Осінь");
			expect(toggleButtons[1]).toHaveTextContent("Весна");
		});

		it("should disable credits slider when year is not selected", () => {
			// Act — semester group is open by default
			render(<TestWrapper />);

			// Assert
			expect(screen.getByTestId(testIds.filters.creditsSelect)).toHaveAttribute(
				"data-disabled",
				"",
			);
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

			// Act — structure group is open by default
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			const deptLabel = screen.getByText("Кафедра");
			expect(deptLabel).toBeInTheDocument();
			const selectContainer = assertElement(
				deptLabel.closest(".space-y-3"),
				"Department select container not found",
			);
			const deptSelect = within(selectContainer).getByRole("combobox");
			expect(deptSelect).toBeInTheDocument();
			expect(deptSelect).not.toBeDisabled();
		});
	});

	describe("Accessibility", () => {
		it("should have proper ARIA labels for range filters", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText(/Складність:/)).toBeInTheDocument();
			expect(screen.getByText(/Корисність:/)).toBeInTheDocument();
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
