import { useCallback } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { createStandardSchemaV1 } from "nuqs";

import Layout from "@/components/Layout";
import { CoursesErrorState } from "@/features/courses/components/CoursesErrorState";
import { CoursesTable } from "@/features/courses/components/CoursesTable";
import {
	courseFiltersParams,
	useCourseFiltersParams,
} from "@/features/courses/courseFiltersParams";
import type { CoursesListParams } from "@/lib/api/generated";
import { useCoursesList } from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";

function CoursesRoute() {
	const [params, setParams] = useCourseFiltersParams();

	// Convert nuqs params directly to API params
	const apiFilters: CoursesListParams = {
		page: params.page,
		page_size: params.size,
		name: params.q || undefined,
		avg_difficulty_min: params.diff[0] !== 1 ? params.diff[0] : undefined,
		avg_difficulty_max: params.diff[1] !== 5 ? params.diff[1] : undefined,
		avg_usefulness_min: params.use[0] !== 1 ? params.use[0] : undefined,
		avg_usefulness_max: params.use[1] !== 5 ? params.use[1] : undefined,
		faculty: params.faculty || undefined,
		department: params.dept || undefined,
		instructor: params.instructor || undefined,
		semester_term: params.term || undefined,
		semester_year: params.year || undefined,
		type_kind: params.type || undefined,
		speciality: params.spec || undefined,
	};

	const { data, isFetching, isError, refetch } = useCoursesList(apiFilters, {
		query: {
			placeholderData: keepPreviousData,
		},
	});

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
						params={params}
						setParams={setParams}
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
	validateSearch: createStandardSchemaV1(courseFiltersParams, {
		partialOutput: true,
	}),
});
