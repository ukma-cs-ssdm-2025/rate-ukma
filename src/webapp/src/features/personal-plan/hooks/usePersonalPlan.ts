import { useMemo } from "react";

import { useStudentsMePlanRetrieve } from "@/lib/api/generated";
import { summarizePlan } from "../planRules";
import { usePlanActions } from "./usePlanActions";

/** The plan the backend keeps: САЗ, mandatory courses and the student's picks. */
export function usePersonalPlan({ enabled }: Readonly<{ enabled: boolean }>) {
	const plan = useStudentsMePlanRetrieve({ query: { enabled } });
	const actions = usePlanActions();

	const years = useMemo(() => plan.data?.plan_years ?? [], [plan.data]);
	const summary = useMemo(() => summarizePlan(years), [years]);

	return {
		years,
		summary,
		actions,
		currentYearStart: plan.data?.current_year_start ?? 0,
		isLoading: plan.isLoading,
		error: plan.error,
		isRetrying: plan.isFetching && !plan.isLoading,
		refetch: plan.refetch,
	};
}
