import * as React from "react";

import type { UseFormReturn } from "react-hook-form";

import type { FilterOptions } from "@/lib/api/generated";
import {
	DIFFICULTY_RANGE,
	formatDecimalValue,
	getCourseTypeDisplay,
	getFacultyAbbreviation,
	getSemesterTermDisplay,
	USEFULNESS_RANGE,
} from "../courseFormatting";
import { DEFAULT_FILTERS, type FilterState } from "../filterSchema";

export function areFiltersActive(filters: FilterState): boolean {
	for (const key of Object.keys(DEFAULT_FILTERS) as (keyof FilterState)[]) {
		const value = filters[key];
		const defaultValue = DEFAULT_FILTERS[key];

		if (Array.isArray(value)) {
			if (!Array.isArray(defaultValue)) {
				return true;
			}
			const defaultArr = defaultValue as [number, number];
			if (value[0] !== defaultArr[0] || value[1] !== defaultArr[1]) {
				return true;
			}
		} else if (value !== defaultValue) {
			return true;
		}
	}
	return false;
}

type SelectOption = {
	value: string;
	label: string;
};

export type SelectFilterConfig = {
	key: string;
	label: string;
	placeholder: string;
	value: string;
	options: SelectOption[];
	contentClassName?: string;
	useCombobox?: boolean;
};

export type RangeFilterConfig = {
	key: keyof Pick<FilterState, "difficultyRange" | "usefulnessRange">;
	label: string;
	value: [number, number];
	range: [number, number];
	captions: [string, string];
};

export type CourseFiltersData = {
	rangeFilters: RangeFilterConfig[];
	selectFilters: SelectFilterConfig[];
	activeBadges: Array<{ key: string; label: string }>;
	hasActiveFilters: boolean;
};

export function useCourseFiltersData({
	form,
	filterOptions,
}: {
	form: UseFormReturn<FilterState>;
	filterOptions?: FilterOptions;
}): CourseFiltersData {
	const filters = form.watch();

	const {
		faculties = [],
		departments: allDepartments = [],
		instructors = [],
		semester_terms: semesterTerms = [],
		semester_years: semesterYears = [],
		course_types: courseTypes = [],
		specialities = [],
	} = filterOptions ?? {};

	const selectedFacultyOption = React.useMemo(
		() => faculties.find((option) => option.id === filters.faculty),
		[faculties, filters.faculty],
	);

	const selectedDepartmentOption = React.useMemo(
		() => allDepartments.find((option) => option.id === filters.department),
		[allDepartments, filters.department],
	);

	const selectedSemesterTermOption = React.useMemo(
		() =>
			semesterTerms.find((option) => option.value === filters.semesterTerm) ??
			null,
		[semesterTerms, filters.semesterTerm],
	);

	const selectedSemesterYearOption = React.useMemo(
		() =>
			semesterYears.find((option) => option.value === filters.semesterYear) ??
			null,
		[semesterYears, filters.semesterYear],
	);

	const selectedInstructorOption = React.useMemo(
		() => instructors.find((option) => option.id === filters.instructor),
		[instructors, filters.instructor],
	);

	const selectedCourseTypeOption = React.useMemo(
		() => courseTypes.find((option) => option.value === filters.courseType),
		[courseTypes, filters.courseType],
	);

	const selectedSpecialityOption = React.useMemo(
		() => specialities.find((option) => option.id === filters.speciality),
		[specialities, filters.speciality],
	);

	const filteredDepartments = React.useMemo(() => {
		if (!filters.faculty) {
			return allDepartments;
		}

		return allDepartments.filter(
			(department) => department.faculty_id === filters.faculty,
		);
	}, [allDepartments, filters.faculty]);

	const rangeFilters: RangeFilterConfig[] = [
		{
			key: "difficultyRange",
			label: "Складність",
			value: filters.difficultyRange,
			range: DIFFICULTY_RANGE,
			captions: ["Легко", "Складно"],
		},
		{
			key: "usefulnessRange",
			label: "Корисність",
			value: filters.usefulnessRange,
			range: USEFULNESS_RANGE,
			captions: ["Низька", "Висока"],
		},
	];

	const selectFilters: SelectFilterConfig[] = React.useMemo(
		() => [
			{
				key: "semesterTerm",
				label: "Семестровий період",
				placeholder: "Усі періоди",
				value: filters.semesterTerm,
				options: semesterTerms.map((term) => ({
					value: term.value,
					label: getSemesterTermDisplay(term.value, term.label),
				})),
			},
			{
				key: "semesterYear",
				label: "Навчальний рік",
				placeholder: "Усі навчальні роки",
				value: filters.semesterYear,
				options: semesterYears.map((year) => ({
					value: year.value,
					label: year.label ?? year.value,
				})),
			},
			{
				key: "faculty",
				label: "Факультет",
				placeholder: "Усі факультети",
				value: filters.faculty,
				options: [
					{ value: "", label: "Усі факультети" },
					...faculties.map((faculty) => ({
						value: faculty.id,
						label: faculty.name,
					})),
				],
				useCombobox: true,
			},
			{
				key: "department",
				label: "Кафедра",
				placeholder: "Усі кафедри",
				value: filters.department,
				options: [
					{ value: "", label: "Усі кафедри" },
					...filteredDepartments.map((department) => ({
						value: department.id,
						label:
							filters.faculty || !department.faculty_name
								? department.name
								: `${department.name} — ${department.faculty_custom_abbreviation || getFacultyAbbreviation(department.faculty_name)}`,
					})),
				],
				useCombobox: true,
			},
			{
				key: "speciality",
				label: "Спеціальність",
				placeholder: "Усі спеціальності",
				value: filters.speciality,
				options: [
					{ value: "", label: "Усі спеціальності" },
					...specialities.map((speciality) => ({
						value: speciality.id,
						label: speciality.faculty_name
							? `${speciality.name} — ${speciality.faculty_name}`
							: speciality.name,
					})),
				],
				contentClassName: "max-h-72",
				useCombobox: true,
			},
			{
				key: "courseType",
				label: "Тип курсу",
				placeholder: "Усі типи курсів",
				value: filters.courseType,
				options: courseTypes.map((type) => ({
					value: type.value,
					label: getCourseTypeDisplay(type.value, type.label),
				})),
			},
			// {
			// 	key: "instructor",
			// 	label: "Викладач",
			// 	placeholder: "Усі викладачі",
			// 	value: filters.instructor,
			// 	options: instructors.map((instructor) => ({
			// 		value: instructor.id,
			// 		label: instructor.name,
			// 	})),
			// 	contentClassName: "max-h-72",
			// }, // unstable backend data
		],
		[
			courseTypes,
			faculties,
			filteredDepartments,
			// instructors, // unstable backend data - commented out from selectFilters
			semesterTerms,
			semesterYears,
			specialities,
			filters.semesterTerm,
			filters.semesterYear,
			filters.faculty,
			filters.department,
			filters.speciality,
			filters.courseType,
			// filters.instructor, // unstable backend data - commented out from selectFilters
		],
	);

	const activeBadges = React.useMemo(() => {
		const badges: Array<{ key: string; label: string }> = [];

		if (filters.searchQuery) {
			badges.push({ key: "search", label: `Пошук: ${filters.searchQuery}` });
		}

		if (
			filters.difficultyRange[0] !== DIFFICULTY_RANGE[0] ||
			filters.difficultyRange[1] !== DIFFICULTY_RANGE[1]
		) {
			badges.push({
				key: "difficulty",
				label: `Складність: ${formatDecimalValue(filters.difficultyRange[0], { fallback: "0" })}-${formatDecimalValue(filters.difficultyRange[1], { fallback: "0" })}`,
			});
		}

		if (
			filters.usefulnessRange[0] !== USEFULNESS_RANGE[0] ||
			filters.usefulnessRange[1] !== USEFULNESS_RANGE[1]
		) {
			badges.push({
				key: "usefulness",
				label: `Корисність: ${formatDecimalValue(filters.usefulnessRange[0], { fallback: "0" })}-${formatDecimalValue(filters.usefulnessRange[1], { fallback: "0" })}`,
			});
		}

		const semesterTermLabel = selectedSemesterTermOption
			? getSemesterTermDisplay(
					selectedSemesterTermOption.value,
					selectedSemesterTermOption.label,
				)
			: null;

		if (selectedSemesterYearOption && semesterTermLabel) {
			badges.push({
				key: "semester",
				label: `Семестр: ${selectedSemesterYearOption.label} ${semesterTermLabel}`,
			});
		} else if (semesterTermLabel) {
			badges.push({
				key: "semesterTerm",
				label: `Період: ${semesterTermLabel}`,
			});
		} else if (selectedSemesterYearOption) {
			badges.push({
				key: "semesterYear",
				label: `Навчальний рік: ${selectedSemesterYearOption.label}`,
			});
		}

		if (selectedFacultyOption) {
			badges.push({
				key: "faculty",
				label: `Факультет: ${selectedFacultyOption.custom_abbreviation || getFacultyAbbreviation(selectedFacultyOption.name)} · ${selectedFacultyOption.name}`,
			});
		}

		if (selectedDepartmentOption) {
			badges.push({
				key: "department",
				label: `Кафедра: ${selectedDepartmentOption.name}`,
			});
		}

		if (selectedSpecialityOption) {
			badges.push({
				key: "speciality",
				label: `Спеціальність: ${selectedSpecialityOption.name}`,
			});
		}

		if (selectedCourseTypeOption) {
			badges.push({
				key: "courseType",
				label: `Тип курсу: ${getCourseTypeDisplay(
					selectedCourseTypeOption.value,
					selectedCourseTypeOption.label,
				)}`,
			});
		}

		if (selectedInstructorOption) {
			badges.push({
				key: "instructor",
				label: `Викладач: ${selectedInstructorOption.name}`,
			});
		}

		return badges;
	}, [
		filters,
		selectedCourseTypeOption,
		selectedDepartmentOption,
		selectedFacultyOption,
		selectedInstructorOption,
		selectedSemesterTermOption,
		selectedSemesterYearOption,
		selectedSpecialityOption,
	]);

	return {
		rangeFilters,
		selectFilters,
		activeBadges,
		hasActiveFilters: areFiltersActive(filters),
	};
}
