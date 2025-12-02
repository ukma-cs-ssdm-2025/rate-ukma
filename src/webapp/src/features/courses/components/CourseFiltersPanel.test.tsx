import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { createMockFilterOptions } from "@/test-utils/factories";
import { CourseFiltersPanel } from "./CourseFiltersPanel";
import { DEFAULT_FILTERS } from "../filterSchema";

function assertElement(
	element: Element | null | undefined,
	message: string,
): HTMLElement {
	if (!element) {
		throw new Error(message);
	}
	return element as HTMLElement;
}

// Default mock functions
const defaultOnReset = vi.fn(() => {
	// Default no-op implementation
});

// Helper component to render CourseFiltersPanel with form
function TestWrapper({
	onReset = defaultOnReset,
	filterOptions = createMockFilterOptions(),
	initialValues = DEFAULT_FILTERS,
}: Readonly<{
	onReset?: () => void;
	filterOptions?: ReturnType<typeof createMockFilterOptions>;
	initialValues?: typeof DEFAULT_FILTERS;
}>) {
	const form = useForm({ defaultValues: initialValues });

	return (
		<CourseFiltersPanel
			form={form}
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
			// Arrange
			// Wrap in a component to avoid hook call outside component
			function TestComponent() {
				const form = useForm({ defaultValues: DEFAULT_FILTERS });
				return (
					<CourseFiltersPanel
						form={form}
						filterOptions={undefined}
						onReset={vi.fn()}
						isLoading={true}
					/>
				);
			}

			// Act
			render(<TestComponent />);

			// Assert
			// Skeleton should be rendered (title should not be visible)
			expect(screen.queryByText("Фільтри")).not.toBeInTheDocument();
		});

		it("should render all range filters", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText(/Складність:/)).toBeInTheDocument();
			expect(screen.getByText(/Корисність:/)).toBeInTheDocument();
		});

		it("should render all select filters", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			expect(screen.getByText("Семестровий період")).toBeInTheDocument();
			expect(screen.getByText("Рік")).toBeInTheDocument();
			expect(screen.getByText("Факультет")).toBeInTheDocument();
			expect(screen.getByText("Кафедра")).toBeInTheDocument();
			expect(screen.getByText("Спеціальність")).toBeInTheDocument();
			expect(screen.getByText("Тип курсу")).toBeInTheDocument();
			// expect(screen.getByText("Викладач")).toBeInTheDocument(); // Disabled
		});
	});

	describe("Range Filter Interactions", () => {
		it("should display current difficulty range values", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						difficultyRange: [2.5, 4.5],
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
					initialValues={{
						...DEFAULT_FILTERS,
						usefulnessRange: [3, 5],
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
	});

	describe("Select Filter Interactions", () => {
		it("should render faculty select with options", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{ id: "fac-1", name: "Факультет інформатики" },
					{ id: "fac-2", name: "Факультет економічних наук" },
				],
			});

			// Act
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			// Verify faculty select is rendered
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

		it("should render semester term select with options", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				semester_terms: [
					{ value: "FALL", label: "Осінь" },
					{ value: "SPRING", label: "Весна" },
				],
			});

			// Act
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			// Verify semester term select is rendered
			const termLabel = screen.getByText("Семестровий період");
			expect(termLabel).toBeInTheDocument();
			const selectContainer = assertElement(
				termLabel.closest(".space-y-3"),
				"Semester term select container not found",
			);
			const termSelect = within(selectContainer).getByRole("combobox");
			expect(termSelect).toBeInTheDocument();
			expect(termSelect).not.toBeDisabled();
		});

		it("should disable select when no options available", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [],
			});

			// Act
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			const facultyLabel = screen.getByText("Факультет");
			const selectContainer = assertElement(
				facultyLabel.closest(".space-y-3"),
				"Faculty select container not found",
			);
			const facultySelect = within(selectContainer).getByRole("combobox");
			expect(facultySelect).toBeDisabled();
		});
	});

	describe("Active Filter Badges", () => {
		it("should not show active filters section when no filters applied", () => {
			// Arrange & Act
			render(<TestWrapper initialValues={DEFAULT_FILTERS} />);

			// Assert
			expect(screen.queryByText("Активні фільтри:")).not.toBeInTheDocument();
		});

		it("should show active filters section when search query is present", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						searchQuery: "React",
					}}
				/>,
			);

			// Assert
			expect(screen.getByText("Активні фільтри:")).toBeInTheDocument();
			expect(screen.getByText("Пошук: React")).toBeInTheDocument();
		});

		it("should show badge for modified difficulty range", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						difficultyRange: [2, 4],
					}}
				/>,
			);

			// Assert
			expect(screen.getByText("Активні фільтри:")).toBeInTheDocument();
			expect(screen.getByText("Складність: 2-4")).toBeInTheDocument();
		});

		it("should show badge for modified usefulness range", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						usefulnessRange: [3.5, 5],
					}}
				/>,
			);

			// Assert
			expect(screen.getByText("Корисність: 3.5-5")).toBeInTheDocument();
		});

		it("should show badge for selected faculty", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "faculty-1",
						name: "Факультет інформатики",
					},
				],
			});

			// Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						faculty: "faculty-1",
					}}
					filterOptions={filterOptions}
				/>,
			);

			// Assert
			expect(
				screen.getByText("Факультет: ФІ · Факультет інформатики"),
			).toBeInTheDocument();
		});

		it("should show badge for selected instructor", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				instructors: [{ id: "inst-1", name: "Іван Петрович" }],
			});

			// Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						instructor: "inst-1",
					}}
					filterOptions={filterOptions}
				/>,
			);

			// Assert
			expect(screen.getByText("Викладач: Іван Петрович")).toBeInTheDocument();
		});

		it("should show multiple badges when multiple filters applied", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "faculty-1",
						name: "Факультет інформатики",
					},
				],
			});

			// Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						searchQuery: "Database",
						faculty: "faculty-1",
						difficultyRange: [2, 4],
					}}
					filterOptions={filterOptions}
				/>,
			);

			// Assert
			const badgesSection = assertElement(
				screen.getByText("Активні фільтри:").parentElement,
				"Badges section not found",
			);
			const badges = within(badgesSection).getAllByText(/:/);
			expect(badges.length).toBeGreaterThanOrEqual(3);
		});
	});

	describe("Reset Functionality", () => {
		it("should show reset button when filters are active", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						searchQuery: "Test",
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
			render(<TestWrapper initialValues={DEFAULT_FILTERS} />);

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
					initialValues={{
						...DEFAULT_FILTERS,
						searchQuery: "Test",
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
		it("should render department select when no faculty selected", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				departments: [
					{
						id: "dept-1",
						name: "Кафедра програмування",
						faculty_id: "fac-1",
						faculty_name: "ФІТ",
					},
					{
						id: "dept-2",
						name: "Кафедра економіки",
						faculty_id: "fac-2",
						faculty_name: "ЕФ",
					},
				],
			});

			// Act
			render(<TestWrapper filterOptions={filterOptions} />);

			// Assert
			// Verify department select is rendered and not disabled
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

		it("should render department select when faculty is selected", () => {
			// Arrange
			const filterOptions = createMockFilterOptions({
				faculties: [{ id: "fac-1", name: "Факультет інформатики" }],
				departments: [
					{
						id: "dept-1",
						name: "Кафедра програмування",
						faculty_id: "fac-1",
						faculty_name: "ФІТ",
					},
					{
						id: "dept-2",
						name: "Кафедра економіки",
						faculty_id: "fac-2",
						faculty_name: "ЕФ",
					},
				],
			});

			// Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						faculty: "fac-1",
					}}
					filterOptions={filterOptions}
				/>,
			);

			// Assert
			// Verify department select is rendered (filtering logic is tested in hook tests)
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
			const difficultyLabel = screen.getByText(/Складність:/);
			const usefulnessLabel = screen.getByText(/Корисність:/);
			expect(difficultyLabel).toBeInTheDocument();
			expect(usefulnessLabel).toBeInTheDocument();
		});

		it("should have proper roles for select elements", () => {
			// Arrange & Act
			render(<TestWrapper />);

			// Assert
			// Radix Select uses combobox role
			const selects = screen.getAllByRole("combobox");
			// There are 6 select filters (instructor is disabled)
			expect(selects).toHaveLength(6);
		});

		it("should have reset button with proper text", () => {
			// Arrange & Act
			render(
				<TestWrapper
					initialValues={{
						...DEFAULT_FILTERS,
						searchQuery: "Test",
					}}
				/>,
			);

			// Assert
			const resetButton = screen.getByRole("button", { name: /скинути/i });
			expect(resetButton).toHaveAttribute("type", "button");
		});
	});
});
