import { type ReactNode, useMemo, useState } from "react";

import Layout from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { useFeatureFlagState } from "@/lib/feature-flags";
import { testIds } from "@/lib/test-ids";
import { usePersonalPlan } from "../hooks/usePersonalPlan";
import { allCourseIds } from "../planTimeline";
import type { PlanTarget, PlanYear } from "../planTypes";
import { AddCourseDialog } from "./AddCourseDialog";
import {
	PlanCreditsSummary,
	PlanCreditsSummarySkeleton,
} from "./PlanCreditsSummary";
import { PlanHeader } from "./PlanHeader";
import { PlanYearSection } from "./PlanYearSection";
import {
	PersonalPlanErrorState,
	PersonalPlanNotStudentState,
	PersonalPlanSkeleton,
} from "./PersonalPlanStates";

/** The current year and the first one still to plan start expanded. */
function openByDefault(year: PlanYear, years: readonly PlanYear[]): boolean {
	const firstPlanned = years.find((item) => item.status === "planned");
	return year.status === "current" || year === firstPlanned;
}

export function PersonalPlanPage() {
	const { enabled, isReady } = useFeatureFlagState("fe_personal_plan");
	const { isStudent } = useAuth();

	return (
		<Layout>
			<div className="space-y-8" data-testid={testIds.personalPlan.page}>
				{resolveContent({ isReady, enabled, isStudent })}
			</div>
		</Layout>
	);
}

function resolveContent({
	isReady,
	enabled,
	isStudent,
}: Readonly<{
	isReady: boolean;
	enabled: boolean;
	isStudent: boolean;
}>): ReactNode {
	// Stay blank until the flag resolves, so a hidden page never flashes in.
	if (!isReady) return null;
	if (!enabled) {
		return (
			<p className="text-muted-foreground">
				Конструктор ІНП наразі недоступний.
			</p>
		);
	}
	if (!isStudent) return <PersonalPlanNotStudentState />;
	return <PersonalPlan />;
}

function PersonalPlan() {
	const plan = usePersonalPlan({ enabled: true });
	const [showBackups, setShowBackups] = useState(true);
	const [openYears, setOpenYears] = useState<Record<number, boolean>>({});
	const [addTarget, setAddTarget] = useState<PlanTarget | null>(null);

	const plannedCourseIds = useMemo(
		() => allCourseIds(plan.years),
		[plan.years],
	);

	if (plan.isLoading) {
		return (
			<>
				<PlanHeader showBackups={showBackups} backupCount={0} />
				<PlanCreditsSummarySkeleton />
				<PersonalPlanSkeleton />
			</>
		);
	}
	if (plan.error) {
		return (
			<PersonalPlanErrorState
				onRetry={plan.refetch}
				isRetrying={plan.isRetrying}
			/>
		);
	}

	return (
		<>
			<PlanHeader
				showBackups={showBackups}
				backupCount={plan.summary.backupCount}
				onShowBackupsChange={setShowBackups}
			/>
			<PlanCreditsSummary summary={plan.summary} />

			<div className="space-y-3">
				{plan.years.map((year) => (
					<PlanYearSection
						key={year.studyYear}
						year={year}
						open={openYears[year.studyYear] ?? openByDefault(year, plan.years)}
						onOpenChange={(open) =>
							setOpenYears((current) => ({
								...current,
								[year.studyYear]: open,
							}))
						}
						showBackups={showBackups}
						actions={plan.actions}
						onAddCourse={(studyYear, term) => setAddTarget({ studyYear, term })}
					/>
				))}
			</div>

			<AddCourseDialog
				target={addTarget}
				years={plan.years}
				plannedCourseIds={plannedCourseIds}
				catalogYearStart={plan.currentYearStart}
				onAdd={plan.actions.add}
				onClose={() => setAddTarget(null)}
			/>
		</>
	);
}
