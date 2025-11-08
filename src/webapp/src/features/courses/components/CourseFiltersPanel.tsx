import * as React from "react";

import { Filter, X } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
import { cn } from "@/lib/utils";
import { CourseFiltersPanelSkeleton } from "./CourseFiltersPanelSkeleton";
import type { FilterState } from "./CoursesTable";
import {
	DIFFICULTY_RANGE,
	getCourseTypeDisplay,
	getFacultyAbbreviation,
	getSemesterTermDisplay,
	USEFULNESS_RANGE,
} from "../courseFormatting";

interface CourseFiltersBaseProps {
	filters: FilterState;
	onFilterChange: <K extends keyof FilterState>(
		key: K,
		value: FilterState[K],
	) => void;
	filterOptions?: FilterOptions;
}

interface CourseFiltersPanelProps extends CourseFiltersBaseProps {
	onReset: () => void;
	isLoading?: boolean;
	className?: string;
}

export interface CourseFiltersDrawerProps extends CourseFiltersBaseProps {
	onReset: () => void;
	onClose: () => void;
	isLoading?: boolean;
	className?: string;
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

type CourseFiltersData = {
	rangeFilters: RangeFilterConfig[];
	selectFilters: SelectFilterConfig[];
	activeBadges: Array<{ key: string; label: string }>;
	hasActiveFilters: boolean;
};

function useCourseFiltersData({
	filters,
	onFilterChange,
	filterOptions,
}: CourseFiltersBaseProps): CourseFiltersData {
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
			key: "difficulty",
			label: "Складність",
			value: filters.difficultyRange,
			onChange: (value) => onFilterChange("difficultyRange", value),
			range: DIFFICULTY_RANGE,
			captions: ["Легко", "Складно"],
		},
		{
			key: "usefulness",
			label: "Корисність",
			value: filters.usefulnessRange,
			onChange: (value) => onFilterChange("usefulnessRange", value),
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
				onChange: (value) => onFilterChange("semesterTerm", value),
				options: semesterTerms.map((term) => ({
					value: term.value,
					label: getSemesterTermDisplay(term.value, term.label),
				})),
			},
			{
				key: "semesterYear",
				label: "Рік",
				placeholder: "Усі роки",
				value: filters.semesterYear,
				onChange: (value) => onFilterChange("semesterYear", value),
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
				onChange: (value) => onFilterChange("faculty", value),
				options: faculties.map((faculty) => ({
					value: faculty.id,
					label: `${getFacultyAbbreviation(faculty.name)} - ${faculty.name}`,
				})),
			},
			{
				key: "department",
				label: "Кафедра",
				placeholder: "Усі кафедри",
				value: filters.department,
				onChange: (value) => onFilterChange("department", value),
				options: filteredDepartments.map((department) => ({
					value: department.id,
					label:
						filters.faculty || !department.faculty_name
							? department.name
							: `${department.name} — ${department.faculty_name}`,
				})),
			},
			{
				key: "speciality",
				label: "Спеціальність",
				placeholder: "Усі спеціальності",
				value: filters.speciality,
				onChange: (value) => onFilterChange("speciality", value),
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
				value: filters.courseType,
				onChange: (value) => onFilterChange("courseType", value),
				options: courseTypes.map((type) => ({
					value: type.value,
					label: getCourseTypeDisplay(type.value, type.label),
				})),
			},
			{
				key: "instructor",
				label: "Викладач",
				placeholder: "Усі викладачі",
				value: filters.instructor,
				onChange: (value) => onFilterChange("instructor", value),
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
			filters,
			instructors,
			onFilterChange,
			semesterTerms,
			semesterYears,
			specialities,
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
				label: `Складність: ${filters.difficultyRange[0].toFixed(1)}-${filters.difficultyRange[1].toFixed(1)}`,
			});
		}

		if (
			filters.usefulnessRange[0] !== USEFULNESS_RANGE[0] ||
			filters.usefulnessRange[1] !== USEFULNESS_RANGE[1]
		) {
			badges.push({
				key: "usefulness",
				label: `Корисність: ${filters.usefulnessRange[0].toFixed(1)}-${filters.usefulnessRange[1].toFixed(1)}`,
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
				label: `Рік: ${selectedSemesterYearOption.label}`,
			});
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
		hasActiveFilters: activeBadges.length > 0,
	};
}

interface CourseFiltersContentProps {
	data: CourseFiltersData;
}

function CourseFiltersContent({ data }: CourseFiltersContentProps) {
	return (
		<div className="space-y-6">
			{data.rangeFilters.map(
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

			{data.selectFilters.map(
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

			{data.hasActiveFilters && (
				<div className="pt-4 border-t space-y-2">
					<div className="text-xs font-medium text-muted-foreground">
						Активні фільтри:
					</div>
					<div className="flex flex-wrap gap-2">
						{data.activeBadges.map((badge) => (
							<Badge key={badge.key} variant="secondary" className="text-xs">
								{badge.label}
							</Badge>
						))}
					</div>
				</div>
			)}
		</div>
	);
}

function ResetButton({ onReset }: { onReset: () => void }) {
	return (
		<button
			type="button"
			onClick={onReset}
			className="text-sm text-muted-foreground hover:text-foreground transition-colors"
		>
			Скинути
		</button>
	);
}

export function CourseFiltersPanel({
	onReset,
	isLoading,
	className,
	...baseProps
}: CourseFiltersPanelProps) {
	const data = useCourseFiltersData(baseProps);

	if (isLoading) {
		return <CourseFiltersPanelSkeleton />;
	}

	return (
		<Card className={cn("sticky top-6", className)}>
			<CardHeader className="pb-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg flex items-center gap-2">
						<Filter className="h-5 w-5" />
						Фільтри
					</CardTitle>
					{data.hasActiveFilters && <ResetButton onReset={onReset} />}
				</div>
			</CardHeader>
			<CardContent>
				<CourseFiltersContent data={data} />
			</CardContent>
		</Card>
	);
}

export function CourseFiltersDrawer({
	onReset,
	isLoading,
	onClose,
	className,
	...baseProps
}: CourseFiltersDrawerProps) {
	const data = useCourseFiltersData(baseProps);

	if (isLoading) {
		return <CourseFiltersPanelSkeleton />;
	}

	return (
		<div className={cn(className, "space-y-6")}>
			<div className="flex items-center justify-between">
				<span className="text-lg font-semibold">Фільтри</span>
				<div className="flex items-center gap-2">
					{data.hasActiveFilters && <ResetButton onReset={onReset} />}
					<Button
						variant="ghost"
						size="icon"
						className="h-9 w-9 rounded-full p-0"
						onClick={onClose}
						aria-label="Закрити фільтри"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>
			<CourseFiltersContent data={data} />
		</div>
	);
}
