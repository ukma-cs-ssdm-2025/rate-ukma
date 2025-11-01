import * as React from "react";

import type { CoursesListParams } from "@/lib/api/generated";
import { useCoursesList } from "@/lib/api/generated";
import { CoursesErrorState } from "./components/CoursesErrorState";
import { CoursesHeader } from "./components/CoursesHeader";
import { CoursesTable } from "./components/CoursesTable";

export function CoursesPage() {
	const [filters, setFilters] = React.useState<CoursesListParams>({
		page: 1,
		page_size: 20,
	});

	const { data, isLoading, isError, refetch } = useCoursesList(filters);

	const filtersKey = React.useMemo(() => JSON.stringify(filters), [filters]);

	const handleFiltersChange = React.useCallback(
		(nextFilters: Record<string, unknown>) => {
			setFilters((previous) => {
				const next = nextFilters;
				if (JSON.stringify(previous) === JSON.stringify(next)) {
					return previous;
				}
				return next;
			});
		},
		[],
	);

	const handleRetry = React.useCallback(() => {
		void refetch();
	}, [refetch]);

	return (
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
					pagination={data ? {
						page: data.page,
						pageSize: data.page_size,
						total: data.total,
						totalPages: data.total_pages,
					} : undefined}
				/>
			)}
		</div>
	);
}
