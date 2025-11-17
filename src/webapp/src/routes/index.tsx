import { useCallback, useMemo, useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { AnalyticsScatterPlot } from "@/features/courses/components/AnalyticsScatterPlot";
import { CoursesErrorState } from "@/features/courses/components/CoursesErrorState";
import { CoursesHeader } from "@/features/courses/components/CoursesHeader";
import { CoursesTable } from "@/features/courses/components/CoursesTable";
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
import { useAnalyticsList, useCoursesList } from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";

const DEFAULT_PAGE_SIZE = 20;

function CoursesRoute() {
	const navigate = useNavigate();
	const [viewMode, setViewMode] = useState<ViewMode>("table");
	const [filters, setFilters] = useState<CoursesListParams>({
		page: 1,
		page_size: DEFAULT_PAGE_SIZE,
	});

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

	const isError = coursesQuery.isError || analyticsQuery.isError;
	const isLoading =
		viewMode === "table" ? coursesQuery.isLoading : analyticsQuery.isLoading;

	return (
		<Layout>
			<div className="space-y-8">
				<CoursesHeader />

				<div className="flex justify-center">
					<CoursesViewSwitcher value={viewMode} onValueChange={setViewMode} />
				</div>

				{isError ? (
					<CoursesErrorState onRetry={handleRetry} />
				) : viewMode === "table" ? (
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
					/>
				) : (
					<AnalyticsScatterPlot
						data={analyticsQuery.data ?? []}
						isLoading={isLoading}
					/>
				)}
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/")({
	component: withAuth(CoursesRoute),
});
