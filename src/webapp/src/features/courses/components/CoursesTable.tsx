import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

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
import { DEFAULT_FILTERS, filterSchema } from "../filterSchema";
import {
	transformFiltersToApiParams,
	transformSortingToApiParams,
} from "../filterTransformations";

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

	const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);

	// Use React Hook Form for filter state management
	const form = useForm({
		defaultValues: DEFAULT_FILTERS,
		resolver: zodResolver(filterSchema),
		mode: "onChange",
	});

	const filters = form.watch();

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading;

	// Transform sorting state to API parameters
	const apiSorting = useMemo(() => {
		if (sorting.length === 0) return {};
		const firstSort = sorting[0];
		return transformSortingToApiParams(firstSort.id, firstSort.desc);
	}, [sorting]);

	// Transform filter form state to API parameters
	const apiFilters = useMemo(
		() => transformFiltersToApiParams(filters),
		[filters],
	);

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
		form.reset(DEFAULT_FILTERS);
	}, [form]);

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
									form.setValue("searchQuery", event.target.value, {
										shouldDirty: true,
									})
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
						form={form}
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
					form={form}
					filterOptions={filterOptions}
					onReset={handleResetFilters}
					isLoading={isPanelLoading}
					onClose={() => setIsFiltersDrawerOpen(false)}
				/>
			</Drawer>
		</>
	);
}
