import { useCallback, useEffect, useMemo, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { CoursesErrorState } from "@/features/courses/components/CoursesErrorState";
import { CoursesTable } from "@/features/courses/components/CoursesTable";
import type { FilterState } from "@/features/courses/filterSchema";
import { transformFiltersToApiParams } from "@/features/courses/filterTransformations";
import { searchParamsToFilters } from "@/features/courses/urlSync";
import type { CoursesListParams } from "@/lib/api/generated";
import { useCoursesList } from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";

type CoursesSearch = Record<string, string>;

function CoursesRoute() {
	const search = useSearch({ from: "/" });
	const initialFilters = useMemo(() => searchParamsToFilters(search), [search]);

	const [filters, setFilters] = useState<FilterState>(initialFilters);

	// Sync with URL changes (e.g., browser back/forward)
	useEffect(() => {
		setFilters((previous) => {
			if (JSON.stringify(previous) === JSON.stringify(initialFilters)) {
				return previous;
			}
			return initialFilters;
		});
	}, [initialFilters]);

	// Convert to API params
	const apiFilters = useMemo<CoursesListParams>(
		() => ({
			page: filters.page,
			page_size: filters.page_size,
			...transformFiltersToApiParams(filters),
		}),
		[filters],
	);

	const { data, isFetching, isError, refetch } = useCoursesList(apiFilters, {
		query: {
			placeholderData: keepPreviousData,
		},
	});

	// Create filtersKey WITHOUT pagination for reset-to-page-1 logic
	const filtersKey = useMemo(() => {
		// biome-ignore lint/correctness/noUnusedVariables: Intentionally destructuring to exclude page/page_size
		const { page, page_size, ...filtersOnly } = filters;
		return JSON.stringify(filtersOnly);
	}, [filters]);

	const handleFiltersChange = useCallback((nextFilters: FilterState) => {
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

	return (
		<Layout>
			<div className="space-y-8">
				{isError ? (
					<CoursesErrorState onRetry={handleRetry} />
				) : (
					<CoursesTable
						data={data?.items ?? []}
						isLoading={isFetching}
						filtersKey={filtersKey}
						filters={filters}
						onFiltersChange={handleFiltersChange}
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
		const result: Record<string, string> = {};
		for (const [key, value] of Object.entries(search)) {
			if (typeof value === "string") {
				result[key] = value;
			} else if (typeof value === "number") {
				result[key] = String(value);
			}
		}
		return result;
	},
});
