import { QueryClient } from "@tanstack/react-query";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as generated from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import {
	createMockCourse,
	createMockFilterOptions,
} from "@/test-utils/factories";
import { Providers } from "@/test-utils/render";
import { createTestRouter, renderWithCustomRouter } from "@/test-utils/router";
import { CoursesTable } from "./CoursesTable";
import type { CourseFiltersParamsState } from "../courseFiltersParams";
import {
	CREDITS_RANGE,
	DIFFICULTY_RANGE,
	USEFULNESS_RANGE,
} from "../courseFormatting";

// Real router + provider spies instead of module mocks.

interface QueryStub<TData> {
	data: TData;
	isLoading: boolean;
	error: null;
}

function queryStub<TData>(data: TData): QueryStub<TData> {
	return { data, isLoading: false, error: null };
}

const defaultParams: CourseFiltersParamsState = {
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

const defaultSetParams = vi.fn();

const defaultProps = {
	data: [],
	isLoading: false,
	params: defaultParams,
	setParams: defaultSetParams,
};

beforeEach(() => {
	vi.clearAllMocks();
	vi.useRealTimers();
	vi.spyOn(generated, "useCoursesFilterOptionsRetrieve").mockReturnValue(
		// SAFETY: CoursesTable only reads data/isLoading/error from this query.
		queryStub(createMockFilterOptions()) as ReturnType<
			typeof generated.useCoursesFilterOptionsRetrieve
		>,
	);
	vi.spyOn(generated, "useAnalyticsList").mockReturnValue(
		// SAFETY: CoursesTable only reads data/isLoading/error from this query.
		queryStub([]) as ReturnType<typeof generated.useAnalyticsList>,
	);
	vi.spyOn(generated, "useStudentsMeCoursesRetrieve").mockReturnValue(
		// SAFETY: CoursesTable only reads data/isLoading/error from this query.
		queryStub([]) as ReturnType<typeof generated.useStudentsMeCoursesRetrieve>,
	);
});

async function renderTable(ui: React.ReactNode) {
	await renderWithCustomRouter(createTestRouter(ui));
}

describe("Initial Rendering", () => {
	it("should render search input", async () => {
		// Arrange & Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} />
			</Providers>,
		);

		// Assert
		expect(
			screen.getByPlaceholderText("Пошук курсів за назвою..."),
		).toBeInTheDocument();
	});

	it("should render filter panel on desktop", async () => {
		// Arrange & Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} />
			</Providers>,
		);

		// Assert
		expect(screen.getByText("Фільтри")).toBeInTheDocument();
	});

	it("should render mobile filter button", async () => {
		// Arrange & Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} />
			</Providers>,
		);

		// Assert
		const filterButton = screen.getByRole("button", { name: /фільтри/i });
		expect(filterButton).toBeInTheDocument();
	});

	it("should render skeleton when initial loading", async () => {
		// Arrange & Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} isLoading={true} />
			</Providers>,
		);

		// Assert
		expect(screen.getByRole("table")).toBeInTheDocument();
	});

	it("should render empty state when no data and not loading", async () => {
		// Arrange & Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={[]} isLoading={false} />
			</Providers>,
		);

		// Assert
		expect(
			screen.getByText("Курсів не знайдено за вашим запитом"),
		).toBeInTheDocument();
	});

	it("should render data table when data is present", async () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "React Programming" }),
			createMockCourse({ title: "Database Systems" }),
		];

		// Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);

		// Assert
		expect(screen.getByText("React Programming")).toBeInTheDocument();
		expect(screen.getByText("Database Systems")).toBeInTheDocument();
	});
});

describe("Search Filter", () => {
	it("should update search query when typing in search input", async () => {
		// Arrange
		const user = userEvent.setup();
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} />
			</Providers>,
		);

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
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} />
			</Providers>,
		);

		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "Database");

		await waitFor(
			() => {
				expect(defaultSetParams).toHaveBeenCalledWith(
					expect.objectContaining({ q: "Database", page: 1 }),
				);
			},
			{ timeout: 2000 },
		);
	});

	it("should disable search input when initial loading", async () => {
		// Arrange & Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} isLoading={true} />
			</Providers>,
		);

		// Assert
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		expect(searchInput).toBeDisabled();
	});
});

describe("Pagination", () => {
	it("should initialize pagination with server pagination values", async () => {
		// Arrange
		const pagination = {
			page: 2,
			pageSize: 20,
			total: 100,
			totalPages: 5,
		};

		// Act
		await renderTable(
			<Providers>
				<CoursesTable
					{...defaultProps}
					pagination={pagination}
					data={[createMockCourse()]}
				/>
			</Providers>,
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

		await renderTable(
			<Providers>
				<CoursesTable
					{...defaultProps}
					params={{ ...defaultParams, page: 1, size: 20 }}
					setParams={setParams}
					data={courses}
					pagination={pagination}
				/>
			</Providers>,
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

		await renderTable(
			<Providers>
				<CoursesTable
					{...defaultProps}
					params={{ ...defaultParams, page: 3, size: 20 }}
					setParams={setParams}
					data={courses}
					pagination={pagination}
				/>
			</Providers>,
		);

		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		await user.type(searchInput, "Test");

		await waitFor(
			() => {
				expect(setParams).toHaveBeenCalledWith(
					expect.objectContaining({ q: "Test", page: 1 }),
				);
			},
			{ timeout: 2000 },
		);
	});
});

describe("Filter Options Loading", () => {
	it("should show filter panel title regardless of loading state", async () => {
		// Arrange
		const queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		});

		// Act
		await renderTable(
			<Providers queryClient={queryClient}>
				<CoursesTable {...defaultProps} />
			</Providers>,
		);

		// Assert
		expect(screen.getByText("Фільтри")).toBeInTheDocument();
	});
});

describe("Reset Filters", () => {
	it("should call setParams with defaults when reset is clicked", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();

		await renderTable(
			<Providers>
				<CoursesTable
					{...defaultProps}
					params={{ ...defaultParams, q: "Test", page: 2, size: 20 }}
					setParams={setParams}
				/>
			</Providers>,
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
		});
	});
});

describe("Mobile Filter Drawer", () => {
	it("should open drawer when filter button is clicked", async () => {
		// Arrange
		const user = userEvent.setup();
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} />
			</Providers>,
		);

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
	it("should render course title as a link", async () => {
		// Arrange
		const course = createMockCourse({
			id: "test-course-id",
			title: "React Programming",
		});
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={[course]} />
			</Providers>,
		);

		// Assert
		const link = screen.getByRole("link", { name: "React Programming" });
		expect(link).toBeInTheDocument();
		expect(link).toHaveAttribute("href", "/courses/test-course-id");
	});
});

describe("Course Display", () => {
	it("should display course titles", async () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "Algorithms and Data Structures" }),
			createMockCourse({ title: "Web Development" }),
		];

		// Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);

		// Assert
		expect(
			screen.getByText("Algorithms and Data Structures"),
		).toBeInTheDocument();
		expect(screen.getByText("Web Development")).toBeInTheDocument();
	});

	it("should display course ratings count", async () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "Test Course", ratings_count: 42 }),
		];

		// Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);

		// Assert
		expect(screen.getByText("42")).toBeInTheDocument();
	});

	it("should display average difficulty", async () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "Test Course", avg_difficulty: 3.5 }),
		];

		// Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);

		// Assert
		const difficultyElements = screen.getAllByText("3.5");
		expect(difficultyElements.length).toBeGreaterThan(0);
	});

	it("should display average usefulness", async () => {
		// Arrange
		const courses = [
			createMockCourse({ title: "Test Course", avg_usefulness: 4.2 }),
		];

		// Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);

		// Assert
		const usefulnessElements = screen.getAllByText("4.2");
		expect(usefulnessElements.length).toBeGreaterThan(0);
	});

	it("should display speciality badge", async () => {
		// Arrange
		const courses = [
			createMockCourse({
				title: "Test Course",
				specialities: [
					{
						speciality_id: "spec-1",
						speciality_title: "Інженерія програмного забезпечення",
						speciality_alias: "ІПЗ",
						faculty_name: "Факультет інформатики",
						faculty_id: "faculty-1",
						type_kind: "COMPULSORY" as const,
					},
				],
			}),
		];

		// Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);

		// Assert
		expect(screen.getByText("ІПЗ")).toBeInTheDocument();
	});
});

describe("Accessibility", () => {
	it("should have accessible search input", async () => {
		// Arrange & Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} />
			</Providers>,
		);

		// Assert
		const searchInput = screen.getByPlaceholderText(
			"Пошук курсів за назвою...",
		);
		expect(searchInput).toBeInTheDocument();
		expect(searchInput.tagName.toLowerCase()).toBe("input");
	});

	it("should have accessible filter button with aria-label", async () => {
		// Arrange & Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} />
			</Providers>,
		);

		// Assert
		const filterButton = screen.getByRole("button", { name: /фільтри/i });
		expect(filterButton).toHaveAttribute("aria-label", "Фільтри");
	});
});

describe("Attended Courses Highlighting", () => {
	it("should highlight attended course rows", async () => {
		// Arrange
		const attendedCourseId = "course-attended-1";
		const nonAttendedCourseId = "course-non-attended-2";

		vi.spyOn(generated, "useStudentsMeCoursesRetrieve").mockReturnValue(
			// SAFETY: CoursesTable only reads data/isLoading/error from this query.
			queryStub([{ id: attendedCourseId, offerings: [] }]) as ReturnType<
				typeof generated.useStudentsMeCoursesRetrieve
			>,
		);

		const courses = [
			createMockCourse({ id: attendedCourseId, title: "Attended Course" }),
			createMockCourse({
				id: nonAttendedCourseId,
				title: "Non-Attended Course",
			}),
		];

		// Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);

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
		vi.spyOn(generated, "useStudentsMeCoursesRetrieve").mockReturnValue(
			// SAFETY: CoursesTable only reads data/isLoading/error from this query.
			queryStub([]) as ReturnType<
				typeof generated.useStudentsMeCoursesRetrieve
			>,
		);

		const courses = [
			createMockCourse({ id: "course-1", title: "Course One" }),
			createMockCourse({ id: "course-2", title: "Course Two" }),
		];

		// Act
		await renderTable(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);

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

		const router = createTestRouter(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);
		const navigateSpy = vi.spyOn(router, "navigate");
		await renderWithCustomRouter(router);

		const row = screen.getByText(courseTitle).closest("tr");
		if (!row) throw new Error("Course row not found");

		await user.click(row);

		expect(navigateSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "/courses/$courseId",
				params: { courseId },
			}),
		);
	});

	it("should not navigate when '+N більше' is clicked", async () => {
		const user = userEvent.setup();
		const courseId = "course-2";
		const courseTitle = "Badges Course";
		const specialities = Array.from({ length: 7 }, (_, i) => ({
			speciality_id: `spec-${i + 1}`,
			speciality_title: `Speciality ${i + 1}`,
			speciality_alias: `S${i + 1}`,
			faculty_name: "Факультет інформатики",
			faculty_id: "faculty-1",
			type_kind: "COMPULSORY" as const,
		}));

		const courses = [
			createMockCourse({
				id: courseId,
				title: courseTitle,
				specialities: specialities,
			}),
		];

		const router = createTestRouter(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);
		const navigateSpy = vi.spyOn(router, "navigate");
		await renderWithCustomRouter(router);

		await user.click(screen.getByText("+2 більше"));

		expect(navigateSpy).not.toHaveBeenCalled();
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
		// SAFETY: the stub covers every Selection member getSelection is asserted with.
		const getSelectionSpy = vi
			.spyOn(globalThis, "getSelection")
			.mockReturnValue(selection as Selection);

		const courses = [createMockCourse({ id: courseId, title: courseTitle })];
		const router = createTestRouter(
			<Providers>
				<CoursesTable {...defaultProps} data={courses} />
			</Providers>,
		);
		const navigateSpy = vi.spyOn(router, "navigate");
		await renderWithCustomRouter(router);

		const row = screen.getByText(courseTitle).closest("tr");
		if (!row) throw new Error("Course row not found");

		await user.click(row);

		expect(navigateSpy).not.toHaveBeenCalled();
		getSelectionSpy.mockRestore();
	});
});

describe("Sorting", () => {
	it("should sort by difficulty ascending on first click", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();
		const pagination = {
			page: 3,
			pageSize: 10,
			total: 100,
			totalPages: 10,
		};
		const courses = Array.from({ length: 10 }, () => createMockCourse());

		await renderTable(
			<Providers>
				<CoursesTable
					{...defaultProps}
					data={courses}
					pagination={pagination}
					params={{ ...defaultParams, page: 3 }}
					setParams={setParams}
				/>
			</Providers>,
		);

		const sortButton = screen.getByTestId(
			testIds.courses.difficultySortButtonDesktop,
		);

		await user.click(sortButton);

		expect(setParams).toHaveBeenCalledWith({
			diffOrder: "asc",
			useOrder: null,
			reviewSort: null,
			page: 1,
		});
	});

	it("should sort by usefulness descending on first click", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();
		const pagination = {
			page: 2,
			pageSize: 10,
			total: 100,
			totalPages: 10,
		};
		const courses = Array.from({ length: 10 }, () => createMockCourse());

		await renderTable(
			<Providers>
				<CoursesTable
					{...defaultProps}
					data={courses}
					pagination={pagination}
					params={{ ...defaultParams, page: 2 }}
					setParams={setParams}
				/>
			</Providers>,
		);

		const sortButton = screen.getByTestId(
			testIds.courses.usefulnessSortButtonDesktop,
		);

		await user.click(sortButton);

		expect(setParams).toHaveBeenCalledWith({
			diffOrder: null,
			useOrder: "desc",
			reviewSort: null,
			page: 1,
		});
	});

	it("should clear all sort params when 'Найновіші' is picked (default state)", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();
		const courses = Array.from({ length: 3 }, () => createMockCourse());

		await renderTable(
			<Providers>
				<CoursesTable
					{...defaultProps}
					data={courses}
					params={{ ...defaultParams, diffOrder: "asc" }}
					setParams={setParams}
				/>
			</Providers>,
		);

		await user.click(
			screen.getByRole("button", { name: "Сортування за відгуками" }),
		);
		await user.click(screen.getByRole("menuitem", { name: "Найновіші" }));

		expect(setParams).toHaveBeenCalledWith({
			reviewSort: "newest",
			diffOrder: null,
			useOrder: null,
			page: 1,
		});
	});

	it("should set reviewSort='by-count' when 'За кількістю' is picked", async () => {
		const user = userEvent.setup();
		const setParams = vi.fn();
		const courses = Array.from({ length: 3 }, () => createMockCourse());

		await renderTable(
			<Providers>
				<CoursesTable
					{...defaultProps}
					data={courses}
					params={{ ...defaultParams, useOrder: "desc" }}
					setParams={setParams}
				/>
			</Providers>,
		);

		await user.click(
			screen.getByRole("button", { name: "Сортування за відгуками" }),
		);
		await user.click(screen.getByRole("menuitem", { name: "За кількістю" }));

		expect(setParams).toHaveBeenCalledWith({
			reviewSort: "by-count",
			diffOrder: null,
			useOrder: null,
			page: 1,
		});
	});
});
