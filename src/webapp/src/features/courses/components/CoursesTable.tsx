import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
	type ColumnDef,
	type PaginationState,
	type SortingState,
} from "@tanstack/react-table";
import { BookOpen } from "lucide-react";

import { DataTable } from "@/components/DataTable/DataTable";
import { Input } from "@/components/ui/Input";
import type { CourseList, FilterOptions } from "@/lib/api/generated";
import { useCoursesFilterOptionsRetrieve } from "@/lib/api/generated";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "../courseFormatting";
import { CourseColumnHeader } from "./CourseColumnHeader";
import { CourseFacultyBadge } from "./CourseFacultyBadge";
import { CourseFiltersPanel } from "./CourseFiltersPanel";
import { CourseScoreCell } from "./CourseScoreCell";
import { CoursesEmptyState } from "./CoursesEmptyState";
import { CoursesTableSkeleton } from "./CoursesTableSkeleton";

interface CoursesTableProps {
	data: CourseList[];
	isLoading: boolean;
	onRowClick?: (course: CourseList) => void;
	onFiltersChange?: (filters: Record<string, unknown>) => void;
	filtersKey: string;
}

const columns: ColumnDef<CourseList>[] = [
	{
		id: "title",
		accessorKey: "title",
		header: ({ column }) => (
			<CourseColumnHeader column={column} title="Назва курсу" />
		),
		cell: ({ row }) => {
			const course = row.original;
			return (
				<div className="flex items-center gap-2">
					<span className="font-semibold text-base">{course.title}</span>
					<CourseFacultyBadge facultyName={course.faculty_name} />
				</div>
			);
		},
		enableSorting: false,
		meta: {
			label: "Назва курсу",
			placeholder: "Пошук курсів...",
			variant: "text",
			icon: BookOpen,
			align: "left",
		},
	},
	{
		id: "ratings_count",
		accessorKey: "ratings_count",
		header: ({ column }) => (
			<CourseColumnHeader column={column} title="Відгуки" />
		),
		cell: ({ row }) => {
			const count = row.getValue("ratings_count") as number;
			return (
				<div className="flex items-center justify-center">
					<span className="text-lg font-medium text-muted-foreground">
						{count}
					</span>
				</div>
			);
		},
		enableSorting: false,
		meta: {
			label: "Відгуки",
			align: "center",
		},
	},
	{
		id: "avg_difficulty",
		accessorKey: "avg_difficulty",
		header: ({ column }) => (
			<CourseColumnHeader column={column} title="Складність" />
		),
		cell: ({ row }) => (
			<CourseScoreCell
				value={row.getValue("avg_difficulty") as number}
				variant="difficulty"
			/>
		),
		enableSorting: true,
		meta: {
			label: "Складність",
			placeholder: "Фільтр за складністю...",
			variant: "number",
			range: DIFFICULTY_RANGE,
			align: "center",
		},
	},
	{
		id: "avg_usefulness",
		accessorKey: "avg_usefulness",
		header: ({ column }) => (
			<CourseColumnHeader column={column} title="Корисність" />
		),
		cell: ({ row }) => (
			<CourseScoreCell
				value={row.getValue("avg_usefulness") as number}
				variant="usefulness"
			/>
		),
		enableSorting: true,
		meta: {
			label: "Корисність",
			placeholder: "Фільтр за корисністю...",
			variant: "number",
			range: USEFULNESS_RANGE,
			align: "center",
		},
	},
];

export function CoursesTable({
	data,
	isLoading,
	onRowClick,
	onFiltersChange,
	filtersKey,
}: CoursesTableProps) {
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "avg_difficulty", desc: false },
	]);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: 20,
	});

	const [searchQuery, setSearchQuery] = useState("");
	const [difficultyRange, setDifficultyRange] =
		useState<[number, number]>(DIFFICULTY_RANGE);
	const [usefulnessRange, setUsefulnessRange] =
		useState<[number, number]>(USEFULNESS_RANGE);
	const [selectedFaculty, setSelectedFaculty] = useState<string>("");
	const [selectedDepartment, setSelectedDepartment] = useState<string>("");
	const [selectedInstructor, setSelectedInstructor] = useState<string>("");
	const [selectedSemesterTerm, setSelectedSemesterTerm] = useState<string>("");
	const [selectedSemesterYear, setSelectedSemesterYear] = useState<string>("");
	const [selectedCourseType, setSelectedCourseType] = useState<string>("");
	const [selectedSpeciality, setSelectedSpeciality] = useState<string>("");

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve<
		FilterOptions | undefined
	>();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading && !filterOptions;

	const table = useReactTable({
		data,
		columns,
		manualSorting: true,
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		state: {
			sorting,
			pagination,
		},
	});

	useEffect(() => {
		if (typeof filtersKey === "undefined") {
			return;
		}

		setPagination((previous) =>
			previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 },
		);
	}, [filtersKey]);

	const apiSorting = useMemo(() => {
		if (sorting.length === 0) return {};
		const firstSort = sorting[0];

		// Map frontend sorting IDs to backend API parameters
		if (firstSort.id === "avg_difficulty") {
			return {
				avg_difficulty_order: firstSort.desc ? "desc" : "asc",
			};
		}

		if (firstSort.id === "avg_usefulness") {
			return {
				avg_usefulness_order: firstSort.desc ? "desc" : "asc",
			};
		}

		return {};
	}, [sorting]);

	const apiFilters = useMemo(() => {
		const filters: Record<string, unknown> = {};

		if (searchQuery) {
			filters.name = searchQuery;
		}

		if (
			difficultyRange[0] !== DIFFICULTY_RANGE[0] ||
			difficultyRange[1] !== DIFFICULTY_RANGE[1]
		) {
			filters.avg_difficulty_min = difficultyRange[0];
			filters.avg_difficulty_max = difficultyRange[1];
		}

		if (
			usefulnessRange[0] !== USEFULNESS_RANGE[0] ||
			usefulnessRange[1] !== USEFULNESS_RANGE[1]
		) {
			filters.avg_usefulness_min = usefulnessRange[0];
			filters.avg_usefulness_max = usefulnessRange[1];
		}

		if (selectedFaculty) {
			filters.faculty = selectedFaculty;
		}

		if (selectedDepartment) {
			filters.department = selectedDepartment;
		}

		if (selectedInstructor) {
			filters.instructor = selectedInstructor;
		}

		if (selectedCourseType) {
			filters.typeKind = selectedCourseType;
		}

		if (selectedSpeciality) {
			filters.speciality = selectedSpeciality;
		}

		if (selectedSemesterTerm) {
			filters.semesterTerm = selectedSemesterTerm;
		}

		if (selectedSemesterYear) {
			const parsedYear = Number(selectedSemesterYear);
			if (!Number.isNaN(parsedYear)) {
				filters.semesterYear = parsedYear;
			}
		}

		return filters;
	}, [
		searchQuery,
		difficultyRange,
		usefulnessRange,
		selectedFaculty,
		selectedDepartment,
		selectedInstructor,
		selectedCourseType,
		selectedSpeciality,
		selectedSemesterTerm,
		selectedSemesterYear,
	]);

	const combinedFilters = useMemo(
		() => ({ ...apiSorting, ...apiFilters }),
		[apiSorting, apiFilters],
	);

	const previousFiltersRef = useRef<Record<string, unknown>>({});

	useEffect(() => {
		const hasFiltersChanged =
			JSON.stringify(combinedFilters) !==
			JSON.stringify(previousFiltersRef.current);

		if (!hasFiltersChanged) {
			return;
		}

		const timeout = setTimeout(() => {
			previousFiltersRef.current = combinedFilters;
			onFiltersChange?.(combinedFilters);
		}, 500);

		return () => clearTimeout(timeout);
	}, [combinedFilters, onFiltersChange]);

	const handleResetFilters = useCallback(() => {
		setSearchQuery("");
		setDifficultyRange(DIFFICULTY_RANGE);
		setUsefulnessRange(USEFULNESS_RANGE);
		setSelectedFaculty("");
		setSelectedDepartment("");
		setSelectedInstructor("");
		setSelectedSemesterTerm("");
		setSelectedSemesterYear("");
		setSelectedCourseType("");
		setSelectedSpeciality("");
	}, []);

	const [hasResolvedFirstFetch, setHasResolvedFirstFetch] = useState(false);

	useEffect(() => {
		if (!isLoading) {
			setHasResolvedFirstFetch(true);
		}
	}, [isLoading]);

	const isInitialLoading = !hasResolvedFirstFetch && isLoading;
	const isPanelLoading = isInitialLoading || isFilterOptionsLoading;
	const isEmptyState = !isLoading && data.length === 0;

	useEffect(() => {
		if (!selectedFaculty) {
			return;
		}

		if (!filterOptions?.departments?.length) {
			return;
		}

		const isValidDepartment = filterOptions.departments.some(
			(department) =>
				department.id === selectedDepartment &&
				department.faculty_id === selectedFaculty,
		);

		if (!isValidDepartment) {
			setSelectedDepartment("");
		}
	}, [filterOptions, selectedDepartment, selectedFaculty]);

	return (
		<div className="flex gap-6">
			<div className="flex-1 min-w-0 space-y-4">
				<div className="flex items-center gap-4">
					<div className="relative flex-1">
						<BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
						<Input
							placeholder="Пошук курсів за назвою..."
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							className="pl-10 h-12 text-base"
							disabled={isInitialLoading}
						/>
					</div>
				</div>

				{isInitialLoading ? (
					<CoursesTableSkeleton />
				) : isEmptyState ? (
					<CoursesEmptyState />
				) : (
					<DataTable table={table} onRowClick={onRowClick} />
				)}
			</div>

			<div className="w-80 shrink-0">
				<CourseFiltersPanel
					isLoading={isPanelLoading}
					difficultyRange={difficultyRange}
					onDifficultyChange={setDifficultyRange}
					usefulnessRange={usefulnessRange}
					onUsefulnessChange={setUsefulnessRange}
					filterOptions={filterOptions}
					selectedFaculty={selectedFaculty}
					onFacultyChange={setSelectedFaculty}
					selectedDepartment={selectedDepartment}
					onDepartmentChange={setSelectedDepartment}
					selectedInstructor={selectedInstructor}
					onInstructorChange={setSelectedInstructor}
					selectedSemesterTerm={selectedSemesterTerm}
					onSemesterTermChange={setSelectedSemesterTerm}
					selectedSemesterYear={selectedSemesterYear}
					onSemesterYearChange={setSelectedSemesterYear}
					selectedCourseType={selectedCourseType}
					onCourseTypeChange={setSelectedCourseType}
					selectedSpeciality={selectedSpeciality}
					onSpecialityChange={setSelectedSpeciality}
					onReset={handleResetFilters}
					searchQuery={searchQuery}
				/>
			</div>
		</div>
	);
}
