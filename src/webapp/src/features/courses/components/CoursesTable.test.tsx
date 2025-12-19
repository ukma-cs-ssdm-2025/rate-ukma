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
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "../courseFormatting";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual("@tanstack/react-router");
	return {
		...actual,
		useNavigate: vi.fn(function () {
			return mockNavigate;
		}),
		Link: ({
			to,
			params,
			children,
			className,
		}: {
			to: string;
			params?: Record<string, string>;
			children: React.ReactNode;
			className?: string;
		}) => (
			<a href={to} data-params={JSON.stringify(params)} className={className}>
				{children}
			</a>
		),
	};
});

// Mock the filter options API hook
vi.mock("@/lib/api/generated", async () => {
	const actual = await vi.importActual("@/lib/api/generated");
	return {
		...actual,
		useCoursesFilterOptionsRetrieve: vi.fn(function () {
			return {
				data: createMockFilterOptions(),
				isLoading: false,
				error: null,
			};
		}),
		useAnalyticsList: vi.fn(function () {
			return {
				data: [],
				isLoading: false,
				error: null,
			};
		}),
		useStudentsMeCoursesRetrieve: vi.fn(function () {
			return {
				data: [],
				isLoading: false,
				error: null,
			};
		}),
	};
});

const defaultParams: CourseFiltersParamsState = {
	q: "",
	diff: DIFFICULTY_RANGE,
	use: USEFULNESS_RANGE,
	faculty: "",
	dept: "",
	instructor: "",
	term: null,
	year: "",
	type: null,
	spec: "",
	page: 1,
	size: 10,
};

const defaultSetParams = vi.fn();

const defaultProps = {
	data: [],
	isLoading: false,
	params: defaultParams,
	setParams: defaultSetParams,
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
		expect(
			screen.getByText("Курсів не знайдено за вашим запитом"),
		).toBeInTheDocument();
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
		renderWithProviders(<CoursesTable {...defaultProps} />);

		// Act
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "React");

		// Assert
		expect(searchInput).toHaveValue("React");
	});

	it("should call setParams with search query after debounce", async () => {
		const user = userEvent.setup();
		renderWithProviders(<CoursesTable {...defaultProps} />);

		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "Database");

		await new Promise((resolve) => setTimeout(resolve, 350));

		expect(defaultSetParams).toHaveBeenCalledWith(
			expect.objectContaining({ q: "Database", page: 1 }),
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

	it("should update page params when pagination changes", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();
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
				params={{ ...defaultParams, page: 1, size: 20 }}
				setParams={setParams}
				data={courses}
				pagination={pagination}
			/>,
		);

		const nextButton = screen.getByRole("button", { name: /next/i });
		await user.click(nextButton);

		await waitFor(() => {
			expect(setParams).toHaveBeenCalledWith({ size: 20, page: 2 });
		});
	});

	it("should reset to page 1 when search changes", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();
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
				params={{ ...defaultParams, page: 3, size: 20 }}
				setParams={setParams}
				data={courses}
				pagination={pagination}
			/>,
		);

		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "Test");

		await new Promise((resolve) => setTimeout(resolve, 350));

		expect(setParams).toHaveBeenCalledWith(
			expect.objectContaining({ q: "Test", page: 1 }),
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
	it("should call setParams with defaults when reset is clicked", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();

		renderWithProviders(
			<CoursesTable
				{...defaultProps}
				params={{ ...defaultParams, q: "Test", page: 2, size: 20 }}
				setParams={setParams}
			/>,
		);

		const resetButton = screen.getByRole("button", { name: /скинути/i });
		await user.click(resetButton);

		expect(setParams).toHaveBeenCalledWith({
			q: "",
			diff: DIFFICULTY_RANGE,
			use: USEFULNESS_RANGE,
			faculty: "",
			dept: "",
			instructor: "",
			term: null,
			year: "",
			type: null,
			spec: "",
			page: 1,
			size: 10,
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
	it("should render course title as a link", () => {
		// Arrange
		const course = createMockCourse({
			id: "test-course-id",
			title: "React Programming",
		});
		renderWithProviders(<CoursesTable {...defaultProps} data={[course]} />);

		// Assert
		const link = screen.getByRole("link", { name: "React Programming" });
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute("href", "/courses/$courseId");
		expect(link).toHaveAttribute(
			"data-params",
			JSON.stringify({ courseId: "test-course-id" }),
		);
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
				specialities: [
					{
						speciality_id: "spec-1",
						speciality_title: "Інженерія програмного забезпечення",
						type_kind: "COMPULSORY" as const,
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

describe("Attended Courses Highlighting", () => {
	it("should highlight attended course rows", async () => {
		// Arrange
		const { useStudentsMeCoursesRetrieve } = await import(
			"@/lib/api/generated"
		);
		const mockedHook = vi.mocked(useStudentsMeCoursesRetrieve);
		const attendedCourseId = "course-attended-1";
		const nonAttendedCourseId = "course-non-attended-2";

		mockedHook.mockReturnValue({
			data: [{ id: attendedCourseId, offerings: [] }],
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStudentsMeCoursesRetrieve>);

		const courses = [
			createMockCourse({ id: attendedCourseId, title: "Attended Course" }),
			createMockCourse({
				id: nonAttendedCourseId,
				title: "Non-Attended Course",
			}),
		];

		// Act
		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		// Assert
		const attendedRow = screen.getByText("Attended Course").closest("tr");
		const nonAttendedRow = screen
			.getByText("Non-Attended Course")
			.closest("tr");

		expect(attendedRow).toHaveAttribute("data-highlighted", "true");
		expect(nonAttendedRow).not.toHaveAttribute("data-highlighted");
	});

	it("should not highlight any rows when no attended courses", async () => {
		// Arrange
		const { useStudentsMeCoursesRetrieve } = await import(
			"@/lib/api/generated"
		);
		const mockedHook = vi.mocked(useStudentsMeCoursesRetrieve);

		mockedHook.mockReturnValue({
			data: [],
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStudentsMeCoursesRetrieve>);

		const courses = [
			createMockCourse({ id: "course-1", title: "Course One" }),
			createMockCourse({ id: "course-2", title: "Course Two" }),
		];

		// Act
		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		// Assert
		const rows = screen.getAllByRole("row").filter((row) => {
			return row.closest("tbody");
		});

		for (const row of rows) {
			expect(row).not.toHaveAttribute("data-highlighted");
		}
	});
});

describe("Course Row Navigation", () => {
	it("should navigate to course details when row is clicked", async () => {
		const user = userEvent.setup();
		const courseId = "course-1";
		const courseTitle = "Clickable Course";

		const courses = [createMockCourse({ id: courseId, title: courseTitle })];

		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		const row = screen.getByText(courseTitle).closest("tr");
		expect(row).not.toBeNull();

		await user.click(row as HTMLElement);

		expect(mockNavigate).toHaveBeenCalledWith({
			to: "/courses/$courseId",
			params: { courseId },
		});
	});

	it("should not navigate when '+N більше' is clicked", async () => {
		const user = userEvent.setup();
		const courseId = "course-2";
		const courseTitle = "Badges Course";

		const specialities = Array.from({ length: 7 }, (_, i) => ({
			speciality_id: `spec-${i + 1}`,
			speciality_title: `Speciality ${i + 1}`,
			faculty_name: "Факультет інформатики",
			type_kind: "COMPULSORY" as const,
		}));

		const courses = [
			createMockCourse({
				id: courseId,
				title: courseTitle,
				specialities: specialities,
			}),
		];

		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		await user.click(screen.getByText("+2 більше"));

		expect(mockNavigate).not.toHaveBeenCalled();
	});

	it("should not navigate when selecting text", async () => {
		const user = userEvent.setup();
		const courseId = "course-3";
		const courseTitle = "Selectable Course";

		const selection = {
			type: "Range",
			isCollapsed: false,
			toString: () => courseTitle,
		} satisfies Partial<Selection>;
		const getSelectionSpy = vi
			.spyOn(globalThis, "getSelection")
			.mockReturnValue(selection as Selection);

		const courses = [createMockCourse({ id: courseId, title: courseTitle })];
		renderWithProviders(<CoursesTable {...defaultProps} data={courses} />);

		const row = screen.getByText(courseTitle).closest("tr");
		expect(row).not.toBeNull();

		await user.click(row as HTMLElement);

		expect(mockNavigate).not.toHaveBeenCalled();
		getSelectionSpy.mockRestore();
	});
});
