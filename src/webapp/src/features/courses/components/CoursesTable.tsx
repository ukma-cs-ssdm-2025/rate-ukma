import { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "@tanstack/react-router";
import {
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
} from "@tanstack/react-table";
import type { PaginationState, SortingState } from "@tanstack/react-table";
import { Filter, Search } from "lucide-react";

import { DataTable, DataTableSkeleton } from "@/components/DataTable/DataTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import type { CourseList } from "@/lib/api/generated";
import {
	useCoursesFilterOptionsRetrieve,
	useStudentsMeCoursesRetrieve,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth/useAuth";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { CourseFiltersDrawer, CourseFiltersPanel } from "./CourseFiltersPanel";
import type { CoursesReviewsSortOption } from "./CoursesReviewsSortMenu";
import {
	courseFiltersStateToSearchParams,
	DEFAULT_COURSE_FILTERS_PARAMS,
} from "../courseFiltersParams";
import type {
	CourseFiltersParamsSetter,
	CourseFiltersParamsState,
} from "../courseFiltersParams";
import { transformFiltersToApiParams } from "../filterTransformations";
import { useCourseFiltersData } from "../hooks/useCourseFiltersData";
import { buildCoursesTableColumns } from "./coursesTableColumns";
import { DebouncedInput } from "./DebouncedInput";
import { CoursesMapCard } from "./CoursesMapCard";

interface PaginationInfo {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

interface CoursesTableProps {
	data: CourseList[];
	isLoading: boolean;
	params: CourseFiltersParamsState;
	setParams: CourseFiltersParamsSetter;
	pagination?: PaginationInfo;
}
export function CoursesTable({
	data,
	isLoading,
	params,
	setParams,
	pagination: serverPagination,
}: Readonly<CoursesTableProps>) {
	const navigate = useNavigate({ from: "/" });
	const { isStudent } = useAuth();

	const sorting = useMemo<SortingState>(() => {
		const sortState: SortingState = [];

		if (params.diffOrder) {
			sortState.push({
				id: "avg_difficulty",
				desc: params.diffOrder === "desc",
			});
		}

		if (params.useOrder) {
			sortState.push({
				id: "avg_usefulness",
				desc: params.useOrder === "desc",
			});
		}

		return sortState;
	}, [params.diffOrder, params.useOrder]);

	const handleSortingChange = useCallback(
		(updater: SortingState | ((old: SortingState) => SortingState)) => {
			const newSorting =
				typeof updater === "function" ? updater(sorting) : updater;

			const diffSort = newSorting.find((s) => s.id === "avg_difficulty");
			const useSort = newSorting.find((s) => s.id === "avg_usefulness");

			let diffOrder: "asc" | "desc" | null = null;
			if (diffSort) {
				diffOrder = diffSort.desc ? "desc" : "asc";
			}

			let useOrder: "asc" | "desc" | null = null;
			if (useSort) {
				useOrder = useSort.desc ? "desc" : "asc";
			}

			void setParams({
				diffOrder,
				useOrder,
				reviewSort: null,
				page: 1,
			});
		},
		[sorting, setParams],
	);

	const reviewsSortValue = useMemo<CoursesReviewsSortOption | null>(() => {
		if (params.diffOrder || params.useOrder) {
			return null;
		}
		return params.reviewSort ?? "by-count";
	}, [params.diffOrder, params.useOrder, params.reviewSort]);

	const handleReviewsSortChange = useCallback(
		(value: CoursesReviewsSortOption) => {
			void setParams({
				reviewSort: value,
				diffOrder: null,
				useOrder: null,
				page: 1,
			});
		},
		[setParams],
	);

	const pagination = useMemo<PaginationState>(
		() => ({
			pageIndex: Math.max(0, params.page - 1),
			pageSize: params.size,
		}),
		[params.page, params.size],
	);

	const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);
	const isCompactTable = !useMediaQuery("(min-width: 640px)");

	const { data: studentCourses } = useStudentsMeCoursesRetrieve({
		query: {
			enabled: isStudent,
		},
	});

	const attendedCourseIds = useMemo(() => {
		if (!studentCourses) {
			return new Set<string>();
		}
		return new Set(
			studentCourses
				.map((course) => course.id)
				.filter((id): id is string => Boolean(id)),
		);
	}, [studentCourses]);

	const isRowHighlighted = useCallback(
		(course: CourseList) => {
			return course.id ? attendedCourseIds.has(course.id) : false;
		},
		[attendedCourseIds],
	);

	const handleRowClick = useCallback(
		(course: CourseList) => {
			if (!course.id) {
				return;
			}
			void navigate({
				to: "/courses/$courseId",
				params: { courseId: course.id },
			});
		},
		[navigate],
	);

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading;

	const { groups: filterGroups } = useCourseFiltersData({
		params,
		filterOptions,
	});
	const activeFilterCount =
		filterGroups.rating.config.activeCount +
		filterGroups.semester.config.activeCount +
		filterGroups.structure.config.activeCount;

	const apiFilters = useMemo(
		() => transformFiltersToApiParams(params),
		[params],
	);

	const openExplore = useCallback(() => {
		void navigate({
			to: "/explore",
			search: courseFiltersStateToSearchParams(params),
		});
	}, [navigate, params]);

	const columns = useMemo(
		() =>
			buildCoursesTableColumns({
				reviewsSortValue,
				onReviewsSortChange: handleReviewsSortChange,
				compact: isCompactTable,
			}),
		[reviewsSortValue, handleReviewsSortChange, isCompactTable],
	);

	const table = useReactTable({
		data,
		columns,
		manualSorting: true,
		manualPagination: true,
		onSortingChange: handleSortingChange,
		onPaginationChange: (updater) => {
			const newPagination =
				typeof updater === "function" ? updater(pagination) : updater;

			const nextSize = newPagination.pageSize;
			const nextPage = newPagination.pageIndex + 1;
			void setParams({
				size: nextSize,
				page: nextSize !== params.size ? 1 : nextPage,
			});
		},
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		state: {
			sorting,
			pagination,
		},
		pageCount: serverPagination ? serverPagination.totalPages : -1,
	});

	const handleResetFilters = useCallback(() => {
		void setParams(DEFAULT_COURSE_FILTERS_PARAMS);
	}, [setParams]);

	const hasActiveFilters = activeFilterCount > 0 || params.q !== "";

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

	const renderTableContent = () => {
		if (isInitialLoading) {
			return (
				<DataTableSkeleton
					columnCount={isCompactTable ? 3 : 4}
					cellWidths={
						isCompactTable
							? ["auto", "80px", "80px"]
							: ["auto", "150px", "150px", "130px"]
					}
					withViewOptions={false}
				/>
			);
		}
		return (
			<DataTable
				table={table}
				totalRows={serverPagination?.total}
				serverPageCount={serverPagination?.totalPages}
				isRowHighlighted={isRowHighlighted}
				onRowClick={handleRowClick}
				className={cn(
					"transition-opacity duration-200 motion-reduce:transition-none",
					isLoading && "opacity-60",
				)}
				emptyStateMessage={
					hasActiveFilters
						? "За цими фільтрами дисциплін немає"
						: "Дисциплін не знайдено за вашим запитом"
				}
				emptyStateTestId={testIds.courses.emptyState}
				emptyStateAction={
					hasActiveFilters ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-10 px-4"
							onClick={handleResetFilters}
						>
							Скинути фільтри
						</Button>
					) : undefined
				}
				data-testid={testIds.courses.table}
			/>
		);
	};

	return (
		<>
			<div className="flex flex-col gap-6 md:flex-row">
				<div className="min-w-0 flex-1 space-y-4">
					<div className="relative min-h-10 flex-1">
						<Search className="absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
						<DebouncedInput
							placeholder="Пошук дисциплін за назвою..."
							value={params.q}
							onChange={(value) => {
								void setParams({ q: String(value), page: 1 });
							}}
							className="h-10 pl-10 text-sm"
							disabled={isInitialLoading}
							isLoading={isLoading}
							data-testid={testIds.courses.searchInput}
						/>
					</div>

					<ActiveFilterChips
						params={params}
						setParams={setParams}
						filterOptions={filterOptions}
						className="lg:hidden"
					/>

					<CoursesMapCard filters={apiFilters} onOpenFullscreen={openExplore} />

					{renderTableContent()}
				</div>

				<div className="hidden w-80 shrink-0 lg:block">
					<CourseFiltersPanel
						params={params}
						setParams={setParams}
						filterOptions={filterOptions}
						onReset={handleResetFilters}
						isLoading={isPanelLoading}
					/>
				</div>
			</div>

			<div className="sticky bottom-6 z-40 mx-auto flex w-fit pb-[env(safe-area-inset-bottom)] lg:hidden">
				<Button
					type="button"
					className="h-10 gap-2 rounded-full px-5 shadow-lg"
					onClick={toggleFiltersDrawer}
					aria-label={
						activeFilterCount > 0
							? `Фільтри (${activeFilterCount} активних)`
							: "Фільтри"
					}
					data-testid={testIds.filters.drawerTrigger}
				>
					<Filter className="size-4" aria-hidden="true" />
					Фільтри
					{activeFilterCount > 0 && (
						<Badge className="border-transparent bg-primary-foreground text-primary">
							{activeFilterCount}
						</Badge>
					)}
				</Button>
			</div>

			<Drawer
				open={isFiltersDrawerOpen}
				side="bottom"
				onOpenChange={(open) => setIsFiltersDrawerOpen(open)}
				ariaLabel="Фільтри дисциплін"
			>
				<CourseFiltersDrawer
					params={params}
					setParams={setParams}
					filterOptions={filterOptions}
					onReset={handleResetFilters}
					isLoading={isPanelLoading}
					onClose={() => setIsFiltersDrawerOpen(false)}
				/>
			</Drawer>
		</>
	);
}
