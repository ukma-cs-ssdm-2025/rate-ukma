import { describe, expect, it, vi } from "vitest";

import { renderHookWithProviders } from "@/test-utils/render";
import { useAttendedCourses } from "./useAttendedCourses";

vi.mock("@/lib/api/generated", async () => {
	const actual = await vi.importActual("@/lib/api/generated");
	return {
		...actual,
		useStudentsMeCoursesRetrieve: vi.fn(),
	};
});

import { useStudentsMeCoursesRetrieve } from "@/lib/api/generated";

const mockUseStudentsMeCoursesRetrieve = vi.mocked(
	useStudentsMeCoursesRetrieve,
);

describe("useAttendedCourses", () => {
	it("should return empty set when data is undefined", () => {
		// Arrange
		mockUseStudentsMeCoursesRetrieve.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStudentsMeCoursesRetrieve>);

		// Act
		const { result } = renderHookWithProviders(() => useAttendedCourses());

		// Assert
		expect(result.current.attendedCourseIds).toEqual(new Set());
		expect(result.current.isLoading).toBe(false);
	});

	it("should return empty set when data is empty array", () => {
		// Arrange
		mockUseStudentsMeCoursesRetrieve.mockReturnValue({
			data: [],
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStudentsMeCoursesRetrieve>);

		// Act
		const { result } = renderHookWithProviders(() => useAttendedCourses());

		// Assert
		expect(result.current.attendedCourseIds).toEqual(new Set());
	});

	it("should return set of course IDs when data is present", () => {
		// Arrange
		const mockData = [
			{ id: "course-1", offerings: [] },
			{ id: "course-2", offerings: [] },
			{ id: "course-3", offerings: [] },
		];

		mockUseStudentsMeCoursesRetrieve.mockReturnValue({
			data: mockData,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStudentsMeCoursesRetrieve>);

		// Act
		const { result } = renderHookWithProviders(() => useAttendedCourses());

		// Assert
		expect(result.current.attendedCourseIds).toEqual(
			new Set(["course-1", "course-2", "course-3"]),
		);
	});

	it("should filter out undefined IDs", () => {
		// Arrange
		const mockData = [
			{ id: "course-1", offerings: [] },
			{ id: undefined, offerings: [] },
			{ id: "course-3", offerings: [] },
		];

		mockUseStudentsMeCoursesRetrieve.mockReturnValue({
			data: mockData,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStudentsMeCoursesRetrieve>);

		// Act
		const { result } = renderHookWithProviders(() => useAttendedCourses());

		// Assert
		expect(result.current.attendedCourseIds).toEqual(
			new Set(["course-1", "course-3"]),
		);
	});

	it("should return isLoading from query", () => {
		// Arrange
		mockUseStudentsMeCoursesRetrieve.mockReturnValue({
			data: undefined,
			isLoading: true,
			error: null,
		} as ReturnType<typeof useStudentsMeCoursesRetrieve>);

		// Act
		const { result } = renderHookWithProviders(() => useAttendedCourses());

		// Assert
		expect(result.current.isLoading).toBe(true);
	});

	it("should return error from query", () => {
		// Arrange
		const mockError = new Error("Failed to fetch");
		mockUseStudentsMeCoursesRetrieve.mockReturnValue({
			data: undefined,
			isLoading: false,
			error: mockError,
		} as unknown as ReturnType<typeof useStudentsMeCoursesRetrieve>);

		// Act
		const { result } = renderHookWithProviders(() => useAttendedCourses());

		// Assert
		expect(result.current.error).toBe(mockError);
	});

	it("should return raw attendedCourses data", () => {
		// Arrange
		const mockData = [
			{ id: "course-1", offerings: [{ id: "offering-1" }] },
			{ id: "course-2", offerings: [] },
		];

		mockUseStudentsMeCoursesRetrieve.mockReturnValue({
			data: mockData,
			isLoading: false,
			error: null,
		} as ReturnType<typeof useStudentsMeCoursesRetrieve>);

		// Act
		const { result } = renderHookWithProviders(() => useAttendedCourses());

		// Assert
		expect(result.current.attendedCourses).toEqual(mockData);
	});
});
