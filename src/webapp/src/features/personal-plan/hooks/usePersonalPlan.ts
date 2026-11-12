import { useMemo } from "react";

import { useAuth } from "@/lib/auth";
import { summarizePlan } from "../planRules";
import { buildPlanYears, currentAcademicYearStart } from "../planTimeline";
import { usePlannedCourses } from "./usePlannedCourses";
import { useTakenCourses } from "./useTakenCourses";

/** САЗ history for past and current years, the student's picks after that. */
export function usePersonalPlan({ enabled }: Readonly<{ enabled: boolean }>) {
	const { user } = useAuth();
	const taken = useTakenCourses({ enabled });
	const { planned, ...actions } = usePlannedCourses(user?.id);

	const currentYearStart = currentAcademicYearStart(new Date());
	// A student with no САЗ history yet is a first-year.
	const enrollmentYearStart = taken.enrollmentYearStart ?? currentYearStart;

	const years = useMemo(
		() =>
			buildPlanYears({
				enrollmentYearStart,
				currentYearStart,
				taken: taken.taken,
				planned,
			}),
		[enrollmentYearStart, currentYearStart, taken.taken, planned],
	);

	const summary = useMemo(() => summarizePlan(years), [years]);

	return {
		years,
		summary,
		actions,
		currentYearStart,
		isLoading: taken.isLoading,
		error: taken.error,
		isRetrying: taken.isRetrying,
		refetch: taken.refetch,
	};
}
