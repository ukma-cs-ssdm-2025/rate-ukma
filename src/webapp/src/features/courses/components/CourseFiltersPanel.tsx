import * as React from "react";

import { Filter } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label } from "@/components/ui/Label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { Slider } from "@/components/ui/Slider";
import type { FilterOptions } from "@/lib/api/generated";
import { CourseFiltersPanelSkeleton } from "./CourseFiltersPanelSkeleton";
import {
	DIFFICULTY_RANGE,
	getCourseTypeDisplay,
	getFacultyAbbreviation,
	getSemesterTermDisplay,
	USEFULNESS_RANGE,
} from "../courseFormatting";

interface CourseFiltersPanelProps {
	difficultyRange: [number, number];
	onDifficultyChange: (value: [number, number]) => void;
	usefulnessRange: [number, number];
	onUsefulnessChange: (value: [number, number]) => void;
	filterOptions?: FilterOptions;
	selectedFaculty: string;
	onFacultyChange: (value: string) => void;
	selectedDepartment: string;
	onDepartmentChange: (value: string) => void;
	selectedInstructor: string;
	onInstructorChange: (value: string) => void;
	selectedSemesterTerm: string;
	onSemesterTermChange: (value: string) => void;
	selectedSemesterYear: string;
	onSemesterYearChange: (value: string) => void;
	selectedCourseType: string;
	onCourseTypeChange: (value: string) => void;
	selectedSpeciality: string;
	onSpecialityChange: (value: string) => void;
	onReset: () => void;
	searchQuery: string;
	isLoading?: boolean;
}

type SelectOption = {
	value: string;
	label: string;
};

type SelectFilterConfig = {
	key: string;
	label: string;
	placeholder: string;
	value: string;
	onChange: (value: string) => void;
	options: SelectOption[];
	contentClassName?: string;
};

type RangeFilterConfig = {
	key: string;
	label: string;
	value: [number, number];
	onChange: (value: [number, number]) => void;
	range: [number, number];
	captions: [string, string];
};

export function CourseFiltersPanel({
	difficultyRange,
	onDifficultyChange,
	usefulnessRange,
	onUsefulnessChange,
	filterOptions,
	selectedFaculty,
	onFacultyChange,
	selectedDepartment,
	onDepartmentChange,
	selectedInstructor,
	onInstructorChange,
	selectedSemesterTerm,
	onSemesterTermChange,
	selectedSemesterYear,
	onSemesterYearChange,
	selectedCourseType,
	onCourseTypeChange,
	selectedSpeciality,
	onSpecialityChange,
	onReset,
	searchQuery,
	isLoading,
}: CourseFiltersPanelProps) {
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
		() => faculties.find((option) => option.id === selectedFaculty),
		[faculties, selectedFaculty],
	);

	const selectedDepartmentOption = React.useMemo(
		() => allDepartments.find((option) => option.id === selectedDepartment),
		[allDepartments, selectedDepartment],
	);

	const selectedSemesterTermOption = React.useMemo(
		() =>
			semesterTerms.find((option) => option.value === selectedSemesterTerm) ??
			null,
		[semesterTerms, selectedSemesterTerm],
	);

	const selectedSemesterYearOption = React.useMemo(
		() =>
			semesterYears.find((option) => option.value === selectedSemesterYear) ??
			null,
		[semesterYears, selectedSemesterYear],
	);

	const selectedInstructorOption = React.useMemo(
		() => instructors.find((option) => option.id === selectedInstructor),
		[instructors, selectedInstructor],
	);

	const selectedCourseTypeOption = React.useMemo(
		() => courseTypes.find((option) => option.value === selectedCourseType),
		[courseTypes, selectedCourseType],
	);

	const selectedSpecialityOption = React.useMemo(
		() => specialities.find((option) => option.id === selectedSpeciality),
		[specialities, selectedSpeciality],
	);

	const filteredDepartments = React.useMemo(() => {
		if (!selectedFaculty) {
			return allDepartments;
		}

		return allDepartments.filter(
			(department) => department.faculty_id === selectedFaculty,
		);
	}, [allDepartments, selectedFaculty]);

	const rangeFilters: RangeFilterConfig[] = [
		{
			key: "difficulty",
			label: "Складність",
			value: difficultyRange,
			onChange: onDifficultyChange,
			range: DIFFICULTY_RANGE,
			captions: ["Легко", "Складно"],
		},
		{
			key: "usefulness",
			label: "Корисність",
			value: usefulnessRange,
			onChange: onUsefulnessChange,
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
				value: selectedSemesterTerm,
				onChange: onSemesterTermChange,
				options: semesterTerms.map((term) => ({
					value: term.value,
					label: getSemesterTermDisplay(term.value, term.label),
				})),
			},
			{
				key: "semesterYear",
				label: "Рік",
				placeholder: "Усі роки",
				value: selectedSemesterYear,
				onChange: onSemesterYearChange,
				options: semesterYears.map((year) => ({
					value: year.value,
					label: year.label ?? year.value,
				})),
			},
			{
				key: "faculty",
				label: "Факультет",
				placeholder: "Усі факультети",
				value: selectedFaculty,
				onChange: onFacultyChange,
				options: faculties.map((faculty) => ({
					value: faculty.id,
					label: `${getFacultyAbbreviation(faculty.name)} - ${faculty.name}`,
				})),
			},
			{
				key: "department",
				label: "Кафедра",
				placeholder: "Усі кафедри",
				value: selectedDepartment,
				onChange: onDepartmentChange,
				options: filteredDepartments.map((department) => ({
					value: department.id,
					label:
						selectedFaculty || !department.faculty_name
							? department.name
							: `${department.name} — ${department.faculty_name}`,
				})),
			},
			{
				key: "speciality",
				label: "Спеціальність",
				placeholder: "Усі спеціальності",
				value: selectedSpeciality,
				onChange: onSpecialityChange,
				options: specialities.map((speciality) => ({
					value: speciality.id,
					label: speciality.faculty_name
						? `${speciality.name} — ${speciality.faculty_name}`
						: speciality.name,
				})),
				contentClassName: "max-h-72",
			},
			{
				key: "courseType",
				label: "Тип курсу",
				placeholder: "Усі типи курсів",
				value: selectedCourseType,
				onChange: onCourseTypeChange,
				options: courseTypes.map((type) => ({
					value: type.value,
					label: getCourseTypeDisplay(type.value, type.label),
				})),
			},
			{
				key: "instructor",
				label: "Викладач",
				placeholder: "Усі викладачі",
				value: selectedInstructor,
				onChange: onInstructorChange,
				options: instructors.map((instructor) => ({
					value: instructor.id,
					label: instructor.name,
				})),
				contentClassName: "max-h-72",
			},
		],
		[
			courseTypes,
			faculties,
			filteredDepartments,
			instructors,
			onSemesterTermChange,
			onSemesterYearChange,
			onCourseTypeChange,
			onDepartmentChange,
			onFacultyChange,
			onInstructorChange,
			onSpecialityChange,
			selectedDepartment,
			selectedFaculty,
			selectedSemesterTerm,
			selectedSemesterYear,
			selectedSpeciality,
			selectedCourseType,
			selectedInstructor,
			semesterTerms,
			semesterYears,
			specialities,
		],
	);

	const activeBadges = React.useMemo(() => {
		const badges: Array<{ key: string; label: string }> = [];

		if (searchQuery) {
			badges.push({ key: "search", label: `Пошук: ${searchQuery}` });
		}

		if (
			difficultyRange[0] !== DIFFICULTY_RANGE[0] ||
			difficultyRange[1] !== DIFFICULTY_RANGE[1]
		) {
			badges.push({
				key: "difficulty",
				label: `Складність: ${difficultyRange[0].toFixed(1)}-${difficultyRange[1].toFixed(1)}`,
			});
		}

		if (
			usefulnessRange[0] !== USEFULNESS_RANGE[0] ||
			usefulnessRange[1] !== USEFULNESS_RANGE[1]
		) {
			badges.push({
				key: "usefulness",
				label: `Корисність: ${usefulnessRange[0].toFixed(1)}-${usefulnessRange[1].toFixed(1)}`,
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
		} else {
			if (semesterTermLabel) {
				badges.push({
					key: "semesterTerm",
					label: `Період: ${semesterTermLabel}`,
				});
			}

			if (selectedSemesterYearOption) {
				badges.push({
					key: "semesterYear",
					label: `Рік: ${selectedSemesterYearOption.label}`,
				});
			}
		}

		if (selectedFacultyOption) {
			badges.push({
				key: "faculty",
				label: `Факультет: ${getFacultyAbbreviation(selectedFacultyOption.name)} · ${selectedFacultyOption.name}`,
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
		difficultyRange,
		searchQuery,
		selectedCourseTypeOption,
		selectedDepartmentOption,
		selectedFacultyOption,
		selectedInstructorOption,
		selectedSemesterTermOption,
		selectedSemesterYearOption,
		selectedSpecialityOption,
		usefulnessRange,
	]);

	const hasActiveFilters = activeBadges.length > 0;

	if (isLoading) {
		return <CourseFiltersPanelSkeleton />;
	}

	return (
		<Card className="sticky top-6">
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg flex items-center gap-2">
						<Filter className="h-5 w-5" />
						Фільтри
					</CardTitle>
					{hasActiveFilters && (
						<button
							type="button"
							onClick={onReset}
							className="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							Скинути
						</button>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-6">
				{rangeFilters.map(
					({ key, label, value, onChange, range, captions }) => (
						<div key={key} className="space-y-3">
							<Label className="text-sm font-medium">
								{label}: {value[0].toFixed(1)} - {value[1].toFixed(1)}
							</Label>
							<Slider
								min={range[0]}
								max={range[1]}
								step={0.1}
								value={value}
								onValueChange={(next) => onChange(next as [number, number])}
								className="w-full"
							/>
							<div className="flex justify-between text-xs text-muted-foreground">
								<span>{captions[0]}</span>
								<span>{captions[1]}</span>
							</div>
						</div>
					),
				)}

				{selectFilters.map(
					({
						key,
						label,
						placeholder,
						value,
						onChange,
						options,
						contentClassName,
					}) => (
						<div key={key} className="space-y-3">
							<Label className="text-sm font-medium">{label}</Label>
							<Select
								value={value || "all"}
								onValueChange={(nextValue) =>
									onChange(nextValue === "all" ? "" : nextValue)
								}
								disabled={options.length === 0}
							>
								<SelectTrigger className="w-full">
									<SelectValue placeholder={placeholder} />
								</SelectTrigger>
								<SelectContent className={contentClassName}>
									<SelectItem value="all">{placeholder}</SelectItem>
									{options.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					),
				)}

				{hasActiveFilters && (
					<div className="pt-4 border-t space-y-2">
						<div className="text-xs font-medium text-muted-foreground">
							Активні фільтри:
						</div>
						<div className="flex flex-wrap gap-2">
							{activeBadges.map((badge) => (
								<Badge key={badge.key} variant="secondary" className="text-xs">
									{badge.label}
								</Badge>
							))}
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
