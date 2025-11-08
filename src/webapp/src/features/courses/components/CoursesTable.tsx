import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
	type ColumnDef,
	getCoreRowModel,
	getPaginationRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { BookOpen, Filter } from "lucide-react";

import { DataTable } from "@/components/DataTable/DataTable";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import type { CourseList } from "@/lib/api/generated";
import { useCoursesFilterOptionsRetrieve } from "@/lib/api/generated";
import { CourseColumnHeader } from "./CourseColumnHeader";
import { CourseFacultyBadge } from "./CourseFacultyBadge";
import { CourseFiltersDrawer, CourseFiltersPanel } from "./CourseFiltersPanel";
import { CourseScoreCell } from "./CourseScoreCell";
import { CoursesEmptyState } from "./CoursesEmptyState";
import { CoursesTableSkeleton } from "./CoursesTableSkeleton";
import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "../courseFormatting";

interface PaginationInfo {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

interface CoursesTableProps {
	data: CourseList[];
	isLoading: boolean;
	onRowClick?: (course: CourseList) => void;
	onFiltersChange?: (filters: Record<string, unknown>) => void;
	filtersKey: string;
	pagination?: PaginationInfo;
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
				<div className="flex flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
					<span className="font-semibold text-sm transition-colors group-hover:text-primary group-hover:underline md:text-base">
						{course.title}
					</span>
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
			<div className="hidden sm:block">
				<CourseColumnHeader column={column} title="Відгуки" />
			</div>
		),
		cell: ({ row }) => {
			const count = row.getValue("ratings_count") as number;
			return (
				<div className="hidden sm:flex items-center justify-center">
					<span className="text-sm font-medium text-muted-foreground md:text-base">
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
			<>
				<div className="md:hidden">
					<CourseColumnHeader column={column} title="Склад." />
				</div>
				<div className="hidden md:block">
					<CourseColumnHeader column={column} title="Складність" />
				</div>
			</>
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
			<>
				<div className="md:hidden">
					<CourseColumnHeader column={column} title="Корисн." />
				</div>
				<div className="hidden md:block">
					<CourseColumnHeader column={column} title="Корисність" />
				</div>
			</>
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

export type FilterState = {
	searchQuery: string;
	difficultyRange: [number, number];
	usefulnessRange: [number, number];
	faculty: string;
	department: string;
	instructor: string;
	semesterTerm: string;
	semesterYear: string;
	courseType: string;
	speciality: string;
};

export const DEFAULT_FILTERS: FilterState = {
	searchQuery: "",
	difficultyRange: DIFFICULTY_RANGE,
	usefulnessRange: USEFULNESS_RANGE,
	faculty: "",
	department: "",
	instructor: "",
	semesterTerm: "",
	semesterYear: "",
	courseType: "",
	speciality: "",
};

export function CoursesTable({
	data,
	isLoading,
	onRowClick,
	onFiltersChange,
	filtersKey,
	pagination: serverPagination,
}: Readonly<CoursesTableProps>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: serverPagination ? serverPagination.page - 1 : 0,
		pageSize: serverPagination ? serverPagination.pageSize : 20,
	});

	const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
	const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);

	const updateFilter = useCallback(
		<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
			setFilters((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading;

	const apiSorting = useMemo(() => {
		if (sorting.length === 0) return {};
		const firstSort = sorting[0];

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
		const isDifficultyModified =
			filters.difficultyRange[0] !== DIFFICULTY_RANGE[0] ||
			filters.difficultyRange[1] !== DIFFICULTY_RANGE[1];

		const isUsefulnessModified =
			filters.usefulnessRange[0] !== USEFULNESS_RANGE[0] ||
			filters.usefulnessRange[1] !== USEFULNESS_RANGE[1];

		const params = {
			name: filters.searchQuery,
			faculty: filters.faculty,
			department: filters.department,
			instructor: filters.instructor,
			typeKind: filters.courseType,
			speciality: filters.speciality,
			semesterTerm: filters.semesterTerm,
			semesterYear: filters.semesterYear
				? Number(filters.semesterYear)
				: undefined,
			...(isDifficultyModified && {
				avg_difficulty_min: filters.difficultyRange[0],
				avg_difficulty_max: filters.difficultyRange[1],
			}),
			...(isUsefulnessModified && {
				avg_usefulness_min: filters.usefulnessRange[0],
				avg_usefulness_max: filters.usefulnessRange[1],
			}),
		};

		return Object.fromEntries(
			Object.entries(params).filter(
				([_, v]) => v !== "" && v !== undefined && !Number.isNaN(v),
			),
		);
	}, [filters]);

	const combinedFilters = useMemo(
		() => ({ ...apiSorting, ...apiFilters }),
		[apiSorting, apiFilters],
	);

	// Update local pagination state when server pagination changes
	useEffect(() => {
		if (serverPagination) {
			setPagination({
				pageIndex: serverPagination.page - 1,
				pageSize: serverPagination.pageSize,
			});
		}
	}, [serverPagination]);

	const table = useReactTable({
		data,
		columns,
		manualSorting: true,
		manualPagination: true,
		onSortingChange: setSorting,
		onPaginationChange: (updater) => {
			const newPagination =
				typeof updater === "function" ? updater(pagination) : updater;

			setPagination(newPagination);

			// Trigger filter change to fetch new page from server, including all current filters
			if (onFiltersChange) {
				onFiltersChange({
					...combinedFilters,
					page: newPagination.pageIndex + 1,
					page_size: newPagination.pageSize,
				});
			}
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		state: {
			sorting,
			pagination,
		},
		pageCount: serverPagination ? serverPagination.totalPages : -1,
	});

	useEffect(() => {
		if (filtersKey === undefined) {
			return;
		}

		setPagination((previous) =>
			previous.pageIndex === 0 ? previous : { ...previous, pageIndex: 0 },
		);
	}, [filtersKey]);

	const previousFiltersRef = useRef<Record<string, unknown>>({});

	// biome-ignore lint/correctness/useExhaustiveDependencies: pagination is intentionally excluded to prevent circular updates
	useEffect(() => {
		const hasFiltersChanged =
			JSON.stringify(combinedFilters) !==
			JSON.stringify(previousFiltersRef.current);

		if (!hasFiltersChanged) {
			return;
		}

		// Reset to page 1 when filters change (do this immediately, not in timeout)
		if (pagination.pageIndex !== 0) {
			setPagination((prev) => ({ ...prev, pageIndex: 0 }));
		}

		const timeout = setTimeout(() => {
			previousFiltersRef.current = combinedFilters;

			// Include current pagination in filters (will be page 1 due to reset above)
			const filtersWithPagination = {
				...combinedFilters,
				page: 1,
				page_size: pagination.pageSize,
			};

			onFiltersChange?.(filtersWithPagination);
		}, 500);

		return () => clearTimeout(timeout);
	}, [combinedFilters, onFiltersChange]);

	const handleResetFilters = useCallback(() => {
		setFilters(DEFAULT_FILTERS);
	}, []);

	const toggleFiltersDrawer = useCallback(() => {
		setIsFiltersDrawerOpen((prev) => !prev);
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

	const renderTableContent = () => {
		if (isInitialLoading) {
			return <CoursesTableSkeleton />;
		}
		if (isEmptyState) {
			return <CoursesEmptyState />;
		}
		return (
			<DataTable
				table={table}
				onRowClick={onRowClick}
				totalRows={serverPagination?.total}
				serverPageCount={serverPagination?.totalPages}
			/>
		);
	};

	return (
		<>
			<div className="flex flex-col gap-6 md:flex-row">
				<div className="flex-1 min-w-0 space-y-4">
					<div className="flex items-center gap-4">
						<div className="relative flex-1">
							<BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
							<Input
								placeholder="Пошук курсів за назвою..."
								value={filters.searchQuery}
								onChange={(event) =>
									updateFilter("searchQuery", event.target.value)
								}
								className="pl-10 h-12 text-base"
								disabled={isInitialLoading}
							/>
						</div>
					</div>

					{renderTableContent()}
				</div>

				<div className="hidden lg:block w-80 shrink-0">
					<CourseFiltersPanel
						filters={filters}
						onFilterChange={updateFilter}
						filterOptions={filterOptions}
						onReset={handleResetFilters}
						isLoading={isPanelLoading}
					/>
				</div>
			</div>

			<button
				type="button"
				className="fixed right-0 z-40 grid h-10 w-10 items-center justify-center rounded-l-2xl border border-border bg-background shadow-lg shadow-black/20 transition hover:bg-accent hover:text-accent-foreground lg:hidden"
				style={{ top: "35%" }}
				onClick={toggleFiltersDrawer}
				aria-label="Фільтри"
			>
				<Filter className="h-6 w-6" />
			</button>

			<Drawer
				open={isFiltersDrawerOpen}
				onOpenChange={(open) => setIsFiltersDrawerOpen(open)}
				ariaLabel="Фільтри курсів"
				closeButtonLabel="Закрити фільтри"
			>
				<CourseFiltersDrawer
					filters={filters}
					onFilterChange={updateFilter}
					filterOptions={filterOptions}
					onReset={handleResetFilters}
					isLoading={isPanelLoading}
					onClose={() => setIsFiltersDrawerOpen(false)}
				/>
			</Drawer>
		</>
	);
}
