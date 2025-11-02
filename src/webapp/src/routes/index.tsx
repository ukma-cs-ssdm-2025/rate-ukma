import { useCallback, useMemo, useState } from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { CoursesErrorState } from "@/features/courses/components/CoursesErrorState";
import { CoursesHeader } from "@/features/courses/components/CoursesHeader";
import { CoursesTable } from "@/features/courses/components/CoursesTable";
import type { CourseList, CoursesListParams } from "@/lib/api/generated";
import { useCoursesList } from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";

const DEFAULT_PAGE_SIZE = 20;

function CoursesRoute() {
	const navigate = useNavigate();
	const [filters, setFilters] = useState<CoursesListParams>({
		page: 1,
		page_size: DEFAULT_PAGE_SIZE,
	});

	const { data, isLoading, isError, refetch } = useCoursesList(filters);

	const filtersKey = useMemo(() => JSON.stringify(filters), [filters]);

	const handleFiltersChange = useCallback((nextFilters: CoursesListParams) => {
		setFilters((previous) => {
			if (
				previous.page === nextFilters.page &&
				previous.page_size === nextFilters.page_size
			) {
				return previous;
			}
			return nextFilters;
		});
	}, []);

	const handleRetry = useCallback(() => {
		refetch();
	}, [refetch]);

	const handleRowClick = useCallback(
		(course: CourseList) => {
			if (course.id) {
				navigate({ to: "/courses/$courseId", params: { courseId: course.id } });
			}
		},
		[navigate],
	);

	return (
		<Layout>
			<div className="space-y-8">
				<CoursesHeader />
				{isError ? (
					<CoursesErrorState onRetry={handleRetry} />
				) : (
					<CoursesTable
						data={data?.items ?? []}
						isLoading={isLoading}
						filtersKey={filtersKey}
						onFiltersChange={handleFiltersChange}
						onRowClick={handleRowClick}
						pagination={
							data
								? {
										page: data.page,
										pageSize: data.page_size,
										total: data.total,
										totalPages: data.total_pages,
									}
								: undefined
						}
					/>
				)}
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/")({
	component: withAuth(CoursesRoute),
});
