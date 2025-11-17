import { useCallback, useMemo, useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Filter } from "lucide-react";

import Layout from "@/components/Layout";
import { Drawer } from "@/components/ui/Drawer";
import { AnalyticsScatterPlot } from "@/features/courses/components/AnalyticsScatterPlot";
import { CourseFiltersDrawer, CourseFiltersPanel } from "@/features/courses/components/CourseFiltersPanel";
import { CoursesErrorState } from "@/features/courses/components/CoursesErrorState";
import { CoursesHeader } from "@/features/courses/components/CoursesHeader";
import { CoursesTable, DEFAULT_FILTERS, type FilterState } from "@/features/courses/components/CoursesTable";
import {
	CoursesViewSwitcher,
	type ViewMode,
} from "@/features/courses/components/CoursesViewSwitcher";
import type {
	AnalyticsListParams,
	CourseAnalytics,
	CourseList,
	CoursesListParams,
} from "@/lib/api/generated";
import { useAnalyticsList, useCoursesList, useCoursesFilterOptionsRetrieve } from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";

const DEFAULT_PAGE_SIZE = 20;

function CoursesRoute() {
	const navigate = useNavigate();
	const [viewMode, setViewMode] = useState<ViewMode>("table");
	const [filters, setFilters] = useState<CoursesListParams>({
		page: 1,
		page_size: DEFAULT_PAGE_SIZE,
	});
	const [uiFilters, setUiFilters] = useState<FilterState>(DEFAULT_FILTERS);
	const [isFiltersDrawerOpen, setIsFiltersDrawerOpen] = useState(false);

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const filterOptions = filterOptionsQuery.data;
	const isFilterOptionsLoading = filterOptionsQuery.isLoading;

	const coursesQuery = useCoursesList(filters, {
		query: { enabled: viewMode === "table" },
	});

	const analyticsFilters: AnalyticsListParams = useMemo(() => {
		const { page, page_size, ...rest } = filters;
		return rest;
	}, [filters]);

	const analyticsQuery = useAnalyticsList(analyticsFilters, {
		query: { enabled: viewMode === "plot" },
	});

	const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

	const handleFiltersChange = useCallback((nextFilters: CoursesListParams) => {
		setFilters((previous) => {
			if (JSON.stringify(previous) === JSON.stringify(nextFilters)) {
				return previous;
			}
			return nextFilters;
		});
	}, []);

	const handleRetry = useCallback(() => {
		if (viewMode === "table") {
			coursesQuery.refetch();
		} else {
			analyticsQuery.refetch();
		}
	}, [viewMode, coursesQuery, analyticsQuery]);

	const handleRowClick = useCallback(
		(course: CourseList | CourseAnalytics) => {
			if (course.id) {
				navigate({ to: "/courses/$courseId", params: { courseId: course.id } });
			}
		},
		[navigate],
	);

	const updateFilter = useCallback(
		<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
			setUiFilters((prev) => ({ ...prev, [key]: value }));
		},
		[],
	);

	const handleResetFilters = useCallback(() => {
		setUiFilters(DEFAULT_FILTERS);
	}, []);

	const toggleFiltersDrawer = useCallback(() => {
		setIsFiltersDrawerOpen((prev) => !prev);
	}, []);

	const isError = coursesQuery.isError || analyticsQuery.isError;
	const isLoading =
		viewMode === "table" ? coursesQuery.isLoading : analyticsQuery.isLoading;
	const isPanelLoading = isLoading || isFilterOptionsLoading;

	return (
		<Layout>
			<div className="space-y-8">
				<CoursesHeader />

				<div className="flex justify-center">
					<CoursesViewSwitcher value={viewMode} onValueChange={setViewMode} />
				</div>

				{isError ? (
					<CoursesErrorState onRetry={handleRetry} />
				) : (
					<div className="flex flex-col gap-6 md:flex-row">
						<div className="flex-1 min-w-0">
							{viewMode === "table" ? (
								<CoursesTable
									data={coursesQuery.data?.items ?? []}
									isLoading={isLoading}
									filtersKey={filtersKey}
									onFiltersChange={handleFiltersChange}
									onRowClick={handleRowClick}
									pagination={
										coursesQuery.data
											? {
													page: coursesQuery.data.page,
													pageSize: coursesQuery.data.page_size,
													total: coursesQuery.data.total,
													totalPages: coursesQuery.data.total_pages,
												}
											: undefined
									}
									externalFilters={uiFilters}
									externalFilterOptions={filterOptions}
									hideFiltersPanel
								/>
							) : (
								<AnalyticsScatterPlot
									data={analyticsQuery.data ?? []}
									isLoading={isLoading}
								/>
							)}
						</div>

						<div className="hidden lg:block w-80 shrink-0">
							<CourseFiltersPanel
								filters={uiFilters}
								onFilterChange={updateFilter}
								filterOptions={filterOptions}
								onReset={handleResetFilters}
								isLoading={isPanelLoading}
							/>
						</div>
					</div>
				)}
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
					filters={uiFilters}
					onFilterChange={updateFilter}
					filterOptions={filterOptions}
					onReset={handleResetFilters}
					isLoading={isPanelLoading}
					onClose={() => setIsFiltersDrawerOpen(false)}
				/>
			</Drawer>
		</Layout>
	);
}

export const Route = createFileRoute("/")({
	component: withAuth(CoursesRoute),
});
