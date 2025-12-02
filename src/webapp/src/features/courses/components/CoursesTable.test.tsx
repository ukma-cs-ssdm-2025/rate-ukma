import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	createMockCourse,
	createMockFilterOptions,
} from "@/test-utils/factories";
import { renderWithProviders } from "@/test-utils/render";
import { CoursesTable } from "./CoursesTable";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		useNavigate: () => mockNavigate,
	};
});

// Mock the filter options API hook
vi.mock("@/lib/api/generated", () => ({
	useCoursesFilterOptionsRetrieve: () => ({
		data: createMockFilterOptions(),
		isLoading: false,
		error: null,
	}),
}));

const defaultProps = {
	data: [],
	isLoading: false,
	filtersKey: "test-key",
};

beforeEach(() => {
	vi.clearAllMocks();
	mockNavigate.mockClear();
	vi.useRealTimers();
});

describe("Initial Rendering", () => {
	it("should render search input", () => {
		// Arrange & Act
		renderWithProviders(<CoursesTable {...defaultProps} />);

		// Assert
		expect(
			screen.getByPlaceholderText("Пошук курсів за назвою..."),
		).toBeInTheDocument();
	});

	it("should render filter panel on desktop", () => {
		// Arrange & Act
		renderWithProviders(<CoursesTable {...defaultProps} />);

		// Assert
		expect(screen.getByText("Фільтри")).toBeInTheDocument();
	});

	it("should render mobile filter button", () => {
		// Arrange & Act
		renderWithProviders(<CoursesTable {...defaultProps} />);

		// Assert
		const filterButton = screen.getByRole("button", { name: /фільтри/i });
		expect(filterButton).toBeInTheDocument();
	});

	it("should render skeleton when initial loading", () => {
		// Arrange & Act
		renderWithProviders(<CoursesTable {...defaultProps} isLoading={true} />);

		// Assert
		expect(screen.getByRole("table")).toBeInTheDocument();
	});

	it("should render empty state when no data and not loading", () => {
		// Arrange & Act
		renderWithProviders(
			<CoursesTable {...defaultProps} data={[]} isLoading={false} />,
		);

		// Assert
		expect(screen.getByText("Курси не знайдено")).toBeInTheDocument();
	});

	it("should render data table when data is present", () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "React Programming" }),
			createMockCourse({ title: "Database Systems" }),
		];

		// Act
		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		// Assert
		expect(screen.getByText("React Programming")).toBeInTheDocument();
		expect(screen.getByText("Database Systems")).toBeInTheDocument();
	});
});

describe("Search Filter", () => {
	it("should update search query when typing in search input", async () => {
		// Arrange
		const user = userEvent.setup();
		const onFiltersChange = vi.fn();
		renderWithProviders(
			<CoursesTable {...defaultProps} onFiltersChange={onFiltersChange} />,
		);

		// Act
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "React");

		// Assert
		expect(searchInput).toHaveValue("React");
	});

	it("should include search query in filter params after debounce", async () => {
		// Arrange
		const user = userEvent.setup();
		const onFiltersChange = vi.fn();
		renderWithProviders(
			<CoursesTable {...defaultProps} onFiltersChange={onFiltersChange} />,
		);

		// Act
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "Database");

		// Assert
		await waitFor(
			() => {
				expect(onFiltersChange).toHaveBeenCalledWith(
					expect.objectContaining({
						name: "Database",
						page: 1,
						page_size: 20,
					}),
				);
			},
			{ timeout: 1000 },
		);
	});

	it("should disable search input when initial loading", () => {
		// Arrange & Act
		renderWithProviders(<CoursesTable {...defaultProps} isLoading={true} />);

		// Assert
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		expect(searchInput).toBeDisabled();
	});
});

describe("Pagination", () => {
	it("should initialize pagination with server pagination values", () => {
		// Arrange
		const pagination = {
			page: 2,
			pageSize: 20,
			total: 100,
			totalPages: 5,
		};

		// Act
		renderWithProviders(
			<CoursesTable
				{...defaultProps}
				pagination={pagination}
				data={[createMockCourse()]}
			/>,
		);

		// Assert
		expect(screen.getByRole("table")).toBeInTheDocument();
		expect(screen.queryByText("Курси не знайдено")).not.toBeInTheDocument();
	});

	it("should call onFiltersChange with correct page when pagination changes", async () => {
		// Arrange
		const user = userEvent.setup();
		const onFiltersChange = vi.fn();
		const courses = Array.from({ length: 20 }, () => createMockCourse());
		const pagination = {
			page: 1,
			pageSize: 20,
			total: 100,
			totalPages: 5,
		};

		renderWithProviders(
			<CoursesTable
				{...defaultProps}
				data={courses}
				pagination={pagination}
				onFiltersChange={onFiltersChange}
			/>,
		);

		// Act
		const nextButton = screen.getByRole("button", { name: /next/i });
		await user.click(nextButton);

		// Assert
		await waitFor(() => {
			expect(onFiltersChange).toHaveBeenCalledWith(
				expect.objectContaining({
					page: 2,
					page_size: 20,
				}),
			);
		});
	});

	it("should reset to page 1 when filters change", async () => {
		// Arrange
		const user = userEvent.setup();
		const onFiltersChange = vi.fn();
		const courses = Array.from({ length: 20 }, () => createMockCourse());
		const pagination = {
			page: 3,
			pageSize: 20,
			total: 100,
			totalPages: 5,
		};

		renderWithProviders(
			<CoursesTable
				{...defaultProps}
				data={courses}
				pagination={pagination}
				onFiltersChange={onFiltersChange}
			/>,
		);

		// Act
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "Test");

		// Assert
		await waitFor(
			() => {
				expect(onFiltersChange).toHaveBeenCalledWith(
					expect.objectContaining({
						page: 1,
					}),
				);
			},
			{ timeout: 1000 },
		);
	});
});

describe("Filter Options Loading", () => {
	it("should show filter panel title regardless of loading state", () => {
		// Arrange
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		});

		// Act
		renderWithProviders(<CoursesTable {...defaultProps} />, {
			queryClient,
		});

		// Assert
		expect(screen.getByText("Фільтри")).toBeInTheDocument();
	});
});

describe("Reset Filters", () => {
	it("should reset all filters to default when reset is clicked", async () => {
		// Arrange
		const user = userEvent.setup();
		const onFiltersChange = vi.fn();
		renderWithProviders(
			<CoursesTable {...defaultProps} onFiltersChange={onFiltersChange} />,
		);

		// Act
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "Test");

		await waitFor(
			() => {
				expect(
					screen.getByRole("button", { name: /скинути/i }),
				).toBeInTheDocument();
			},
			{ timeout: 1000 },
		);

		const resetButton = screen.getByRole("button", { name: /скинути/i });
		await user.click(resetButton);

		// Assert
		await waitFor(() => {
			expect(searchInput).toHaveValue("");
		});
	});
});

describe("Mobile Filter Drawer", () => {
	it("should open drawer when filter button is clicked", async () => {
		// Arrange
		const user = userEvent.setup();
		renderWithProviders(<CoursesTable {...defaultProps} />);

		// Act
		const filterButton = screen.getByRole("button", { name: /фільтри/i });
		await user.click(filterButton);

		// Assert
		await waitFor(() => {
			const allFilterTexts = screen.getAllByText("Фільтри");
			expect(allFilterTexts.length).toBeGreaterThan(1);
		});
	});
});

describe("Row Click Handling", () => {
	it("should call onRowClick when a course row is clicked", async () => {
		// Arrange
		const user = userEvent.setup();
		const onRowClick = vi.fn();
		const course = createMockCourse({ title: "React Programming" });
		renderWithProviders(
			<CoursesTable
				{...defaultProps}
				data={[course]}
				onRowClick={onRowClick}
			/>,
		);

		// Act
		const row = screen.getByText("React Programming").closest("tr");
		expect(row).not.toBeNull();
		await user.click(row as HTMLElement);

		// Assert
		expect(onRowClick).toHaveBeenCalledWith(course);
	});
});

describe("Course Display", () => {
	it("should display course titles", () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "Algorithms and Data Structures" }),
			createMockCourse({ title: "Web Development" }),
		];

		// Act
		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		// Assert
		expect(
			screen.getByText("Algorithms and Data Structures"),
		).toBeInTheDocument();
		expect(screen.getByText("Web Development")).toBeInTheDocument();
	});

	it("should display course ratings count", () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "Test Course", ratings_count: 42 }),
		];

		// Act
		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		// Assert
		expect(screen.getByText("42")).toBeInTheDocument();
	});

	it("should display average difficulty", () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "Test Course", avg_difficulty: 3.5 }),
		];

		// Act
		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		// Assert
		const difficultyElements = screen.getAllByText("3.5");
		expect(difficultyElements.length).toBeGreaterThan(0);
	});

	it("should display average usefulness", () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "Test Course", avg_usefulness: 4.2 }),
		];

		// Act
		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		// Assert
		const usefulnessElements = screen.getAllByText("4.2");
		expect(usefulnessElements.length).toBeGreaterThan(0);
	});

	it("should display speciality badge", () => {
		// Arrange
		const courses = [
			createMockCourse({
				title: "Test Course",
				course_specialities: [
					{
						speciality_id: "spec-1",
						speciality_title: "Інженерія програмного забезпечення",
						type_kind: "MANDATORY" as const,
					},
				],
			}),
		];

		// Act
		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		// Assert
		expect(screen.getByText("ІПЗ")).toBeInTheDocument();
	});
});

describe("Accessibility", () => {
	it("should have accessible search input", () => {
		// Arrange & Act
		renderWithProviders(<CoursesTable {...defaultProps} />);

		// Assert
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		expect(searchInput).toBeInTheDocument();
		expect(searchInput.tagName.toLowerCase()).toBe("input");
	});

	it("should have accessible filter button with aria-label", () => {
		// Arrange & Act
		renderWithProviders(<CoursesTable {...defaultProps} />);

		// Assert
		const filterButton = screen.getByRole("button", { name: /фільтри/i });
		expect(filterButton).toHaveAttribute("aria-label", "Фільтри");
	});
});

describe("URL Sync", () => {
	// Integration test: Verify component syncs user input to URL
	it("should sync search query to URL after debounce", async () => {
		// Arrange
		const user = userEvent.setup();
		renderWithProviders(<CoursesTable {...defaultProps} />);

		// Act
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "React");

		// Assert
		expect(mockNavigate).not.toHaveBeenCalled();

		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalledWith(
					expect.objectContaining({
						search: expect.objectContaining({
							q: "React",
						}),
						replace: true,
					}),
				);
			},
			{ timeout: 1000 },
		);
	});

	it("should use replace: true to avoid history pollution", async () => {
		// Arrange
		const user = userEvent.setup();
		renderWithProviders(<CoursesTable {...defaultProps} />);

		// Act
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "Test");

		// Assert
		await waitFor(
			() => {
				expect(mockNavigate).toHaveBeenCalledWith(
					expect.objectContaining({
						replace: true,
					}),
				);
			},
			{ timeout: 1000 },
		);
	});

	it("should initialize form from URL params", () => {
		// Arrange
		const initialFilters = {
			searchQuery: "Database",
			difficultyRange: [2, 4] as [number, number],
			usefulnessRange: [3, 5] as [number, number],
			faculty: "faculty-1",
			department: "",
			instructor: "",
			semesterTerm: "",
			semesterYear: "",
			courseType: "",
			speciality: "",
		};

		// Act
		renderWithProviders(
			<CoursesTable {...defaultProps} initialFilters={initialFilters} />,
		);

		// Assert
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		expect(searchInput).toHaveValue("Database");
	});
});
