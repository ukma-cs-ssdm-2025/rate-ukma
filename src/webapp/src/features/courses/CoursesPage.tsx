import * as React from "react";

import { useCoursesList } from "@/lib/api/generated";
import { CoursesErrorState } from "./components/CoursesErrorState";
import { CoursesHeader } from "./components/CoursesHeader";
import { CoursesTable } from "./components/CoursesTable";
import type { CourseQueryFilters } from "./hooks/useCourses";

export function CoursesPage() {
	const [filters, setFilters] = React.useState<CourseQueryFilters>({});

	const { data, isLoading, isError, refetch } = useCoursesList(filters);

	const filtersKey = React.useMemo(() => JSON.stringify(filters), [filters]);

	const handleFiltersChange = React.useCallback(
		(nextFilters: Record<string, unknown>) => {
			setFilters((previous) => {
				const next = nextFilters as CourseQueryFilters;
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
					data={data?.data?.items ?? []} // TODO: fix data.data madness
					isLoading={isLoading}
					filtersKey={filtersKey}
					onFiltersChange={handleFiltersChange}
				/>
			)}
		</div>
	);
}
