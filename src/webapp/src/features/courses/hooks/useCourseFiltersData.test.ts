import { renderHook } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { createMockFilterOptions } from "@/test-utils/factories";
import { useCourseFiltersData } from "./useCourseFiltersData";
import { DEFAULT_FILTERS } from "../filterSchema";

describe("useCourseFiltersData", () => {
	describe("Range Filters", () => {
		it("should return difficulty and usefulness range configurations", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({ defaultValues: DEFAULT_FILTERS }),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.rangeFilters).toHaveLength(2);
			expect(result.current.rangeFilters[0].key).toBe("difficultyRange");
			expect(result.current.rangeFilters[0].label).toBe("Складність");
			expect(result.current.rangeFilters[1].key).toBe("usefulnessRange");
			expect(result.current.rangeFilters[1].label).toBe("Корисність");
		});

		it("should include current filter values in range configs", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						difficultyRange: [2.0, 4.0] as [number, number],
					},
				}),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const difficultyFilter = result.current.rangeFilters.find(
				(f) => f.key === "difficultyRange",
			);
			expect(difficultyFilter?.value).toEqual([2.0, 4.0]);
		});

		it("should include range bounds in configurations", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({ defaultValues: DEFAULT_FILTERS }),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const difficultyFilter = result.current.rangeFilters.find(
				(f) => f.key === "difficultyRange",
			);
			expect(difficultyFilter?.range).toEqual([1, 5]);
		});

		it("should include captions for range filters", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({ defaultValues: DEFAULT_FILTERS }),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const difficultyFilter = result.current.rangeFilters.find(
				(f) => f.key === "difficultyRange",
			);
			expect(difficultyFilter?.captions).toEqual(["Легко", "Складно"]);

			const usefulnessFilter = result.current.rangeFilters.find(
				(f) => f.key === "usefulnessRange",
			);
			expect(usefulnessFilter?.captions).toEqual(["Низька", "Висока"]);
		});
	});

	describe("Select Filters", () => {
		it("should return all select filter configurations", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({ defaultValues: DEFAULT_FILTERS }),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.selectFilters).toHaveLength(7);
			const filterKeys = result.current.selectFilters.map((f) => f.key);
			expect(filterKeys).toEqual([
				"semesterTerm",
				"semesterYear",
				"faculty",
				"department",
				"speciality",
				"courseType",
				"instructor",
			]);
		});

		it("should map filter options to select options", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({ defaultValues: DEFAULT_FILTERS }),
			);
			const filterOptions = createMockFilterOptions({
				faculties: [
					{ id: "fac-1", name: "Факультет інформаційних технологій" },
					{ id: "fac-2", name: "Економічний факультет" },
				],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const facultyFilter = result.current.selectFilters.find(
				(f) => f.key === "faculty",
			);
			expect(facultyFilter?.options).toHaveLength(2);
			expect(facultyFilter?.options[0]).toEqual({
				value: "fac-1",
				label: "ФІТ - Факультет інформаційних технологій",
			});
		});

		it("should include current filter values in select configs", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						faculty: "fac-1",
					},
				}),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const facultyFilter = result.current.selectFilters.find(
				(f) => f.key === "faculty",
			);
			expect(facultyFilter?.value).toBe("fac-1");
		});

		it("should handle empty filter options gracefully", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({ defaultValues: DEFAULT_FILTERS }),
			);
			const filterOptions = undefined;

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			result.current.selectFilters.forEach((filter) => {
				expect(filter.options).toEqual([]);
			});
		});
	});

	describe("Department Filtering by Faculty", () => {
		it("should show all departments when no faculty is selected", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({ defaultValues: DEFAULT_FILTERS }),
			);
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
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const departmentFilter = result.current.selectFilters.find(
				(f) => f.key === "department",
			);
			expect(departmentFilter?.options).toHaveLength(2);
		});

		it("should filter departments by selected faculty", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						faculty: "fac-1",
					},
				}),
			);
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
					{
						id: "dept-3",
						name: "Кафедра баз даних",
						faculty_id: "fac-1",
						faculty_name: "ФІТ",
					},
				],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const departmentFilter = result.current.selectFilters.find(
				(f) => f.key === "department",
			);
			expect(departmentFilter?.options).toHaveLength(2);
			expect(departmentFilter?.options.map((o) => o.value)).toEqual([
				"dept-1",
				"dept-3",
			]);
		});

		it("should show department name without faculty when faculty is selected", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						faculty: "fac-1",
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				departments: [
					{
						id: "dept-1",
						name: "Кафедра програмування",
						faculty_id: "fac-1",
						faculty_name: "ФІТ",
					},
				],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const departmentFilter = result.current.selectFilters.find(
				(f) => f.key === "department",
			);
			expect(departmentFilter?.options[0].label).toBe("Кафедра програмування");
		});

		it("should show department with faculty name when no faculty selected", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({ defaultValues: DEFAULT_FILTERS }),
			);
			const filterOptions = createMockFilterOptions({
				departments: [
					{
						id: "dept-1",
						name: "Кафедра програмування",
						faculty_id: "fac-1",
						faculty_name: "ФІТ",
					},
				],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const departmentFilter = result.current.selectFilters.find(
				(f) => f.key === "department",
			);
			expect(departmentFilter?.options[0].label).toBe(
				"Кафедра програмування — ФІТ",
			);
		});
	});

	describe("Active Badges", () => {
		it("should show no badges when using default filters", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({ defaultValues: DEFAULT_FILTERS }),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toHaveLength(0);
			expect(result.current.hasActiveFilters).toBe(false);
		});

		it("should show badge for search query", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						searchQuery: "React",
					},
				}),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "search",
				label: "Пошук: React",
			});
			expect(result.current.hasActiveFilters).toBe(true);
		});

		it("should show badge for modified difficulty range", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						difficultyRange: [2.0, 4.0] as [number, number],
					},
				}),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "difficulty",
				label: "Складність: 2.0-4.0",
			});
		});

		it("should not show badge for default difficulty range", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						difficultyRange: [1, 5] as [number, number],
					},
				}),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			const difficultyBadge = result.current.activeBadges.find(
				(b) => b.key === "difficulty",
			);
			expect(difficultyBadge).toBeUndefined();
		});

		it("should show badge for modified usefulness range", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						usefulnessRange: [3.0, 5.0] as [number, number],
					},
				}),
			);
			const filterOptions = createMockFilterOptions();

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "usefulness",
				label: "Корисність: 3.0-5.0",
			});
		});

		it("should show badge for selected faculty", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						faculty: "faculty-1",
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "faculty-1",
						name: "Факультет інформаційних технологій",
					},
				],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "faculty",
				label: "Факультет: ФІТ · Факультет інформаційних технологій",
			});
		});

		it("should show badge for selected department", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						department: "dept-1",
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				departments: [
					{
						id: "dept-1",
						name: "Кафедра програмування",
						faculty_id: "fac-1",
						faculty_name: "ФІТ",
					},
				],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "department",
				label: "Кафедра: Кафедра програмування",
			});
		});

		it("should show badge for selected instructor", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						instructor: "instructor-1",
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				instructors: [{ id: "instructor-1", name: "Іван Іванович" }],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "instructor",
				label: "Викладач: Іван Іванович",
			});
		});

		it("should show combined semester badge when both year and term selected", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						semesterYear: "2024",
						semesterTerm: "FALL",
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				semester_years: [{ value: "2024", label: "2024" }],
				semester_terms: [{ value: "FALL", label: "Осінь" }],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "semester",
				label: "Семестр: 2024 Осінь",
			});
		});

		it("should show separate term badge when only term selected", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						semesterTerm: "SPRING",
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				semester_terms: [{ value: "SPRING", label: "Весна" }],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "semesterTerm",
				label: "Період: Весна",
			});
		});

		it("should show separate year badge when only year selected", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						semesterYear: "2025",
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				semester_years: [{ value: "2025", label: "2025" }],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "semesterYear",
				label: "Рік: 2025",
			});
		});

		it("should show badge for selected course type", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						courseType: "MANDATORY",
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				course_types: [{ value: "MANDATORY", label: "Обов'язковий" }],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "courseType",
				label: "Тип курсу: Обов'язковий",
			});
		});

		it("should show badge for selected speciality", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						speciality: "spec-1",
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				specialities: [
					{
						id: "spec-1",
						name: "Інженерія програмного забезпечення",
						faculty_name: "ФІТ",
					},
				],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toContainEqual({
				key: "speciality",
				label: "Спеціальність: Інженерія програмного забезпечення",
			});
		});

		it("should show multiple badges when multiple filters applied", () => {
			// Arrange
			const { result: formResult } = renderHook(() =>
				useForm({
					defaultValues: {
						...DEFAULT_FILTERS,
						searchQuery: "Database",
						faculty: "faculty-1",
						difficultyRange: [2.0, 4.0] as [number, number],
					},
				}),
			);
			const filterOptions = createMockFilterOptions({
				faculties: [
					{
						id: "faculty-1",
						name: "Факультет інформаційних технологій",
					},
				],
			});

			// Act
			const { result } = renderHook(() =>
				useCourseFiltersData({
					form: formResult.current,
					filterOptions,
				}),
			);

			// Assert
			expect(result.current.activeBadges).toHaveLength(3);
			expect(result.current.hasActiveFilters).toBe(true);
		});
	});
});
