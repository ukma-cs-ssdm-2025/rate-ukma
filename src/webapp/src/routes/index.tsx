import { useCallback, useEffect, useMemo, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { CoursesErrorState } from "@/features/courses/components/CoursesErrorState";
import { CoursesHeader } from "@/features/courses/components/CoursesHeader";
import { CoursesTable } from "@/features/courses/components/CoursesTable";
import { transformFiltersToApiParams } from "@/features/courses/filterTransformations";
import { searchParamsToFilters } from "@/features/courses/urlSync";
import type { CourseList, CoursesListParams } from "@/lib/api/generated";
import { useCoursesList } from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";

type CoursesSearch = Record<string, string>;

const DEFAULT_PAGE_SIZE = 20;

function CoursesRoute() {
	const navigate = useNavigate();
	const search = useSearch({ from: "/" });
	const initialFilters = useMemo(() => searchParamsToFilters(search), [search]);
	const initialApiFilters = useMemo(
		() => transformFiltersToApiParams(initialFilters),
		[initialFilters],
	);

	const [filters, setFilters] = useState<CoursesListParams>(() => ({
		page: 1,
		page_size: DEFAULT_PAGE_SIZE,
		...initialApiFilters,
	}));

	useEffect(() => {
		const nextFilters: CoursesListParams = {
			page: 1,
			page_size: DEFAULT_PAGE_SIZE,
			...initialApiFilters,
		};

		setFilters((previous) => {
			if (JSON.stringify(previous) === JSON.stringify(nextFilters)) {
				return previous;
			}
			return nextFilters;
		});
	}, [initialApiFilters]);

	const { data, isFetching, isError, refetch } = useCoursesList(filters, {
		query: {
			placeholderData: keepPreviousData,
		},
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
						isLoading={isFetching}
						filtersKey={filtersKey}
						initialFilters={initialFilters}
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
	validateSearch: (search: Record<string, unknown>): CoursesSearch => {
		// Accept all search params as strings
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(search)) {
			if (typeof value === "string") {
				result[key] = value;
			}
		}
		return result;
	},
});
