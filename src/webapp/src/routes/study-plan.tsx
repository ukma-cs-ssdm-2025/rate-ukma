import { useCallback, useMemo, useState } from "react";

import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import type { SemesterContext } from "@/features/study-plan/components/StudyPlanSemester";
import { StudyPlanHeader } from "@/features/study-plan/components/StudyPlanHeader";
import { StudyPlanSummary } from "@/features/study-plan/components/StudyPlanSummary";
import { StudyPlanYearSection } from "@/features/study-plan/components/StudyPlanYearSection";
import { useStudyPlanState } from "@/features/study-plan/hooks/useStudyPlanState";
import {
	MOCK_COURSE_CATALOG,
	MOCK_STUDENT,
	MOCK_STUDY_PLAN,
} from "@/features/study-plan/mockStudyPlan";
import { getPlanSummary } from "@/features/study-plan/studyPlanRules";
import type { PlanYear } from "@/features/study-plan/studyPlanTypes";
import { withAuth } from "@/lib/auth";

function getInitialOpenState(years: readonly PlanYear[]) {
	return Object.fromEntries(
		years.map((year) => [year.key, year.status !== "completed"]),
	);
}

function collectPlannedTitles(years: readonly PlanYear[]): Set<string> {
	const titles = new Set<string>();
	for (const year of years) {
		for (const semester of year.semesters) {
			for (const course of [...semester.courses, ...semester.backups]) {
				titles.add(course.title);
			}
		}
	}
	return titles;
}

function StudyPlan() {
	const { years, ...actions } = useStudyPlanState(MOCK_STUDY_PLAN);
	const [openState, setOpenState] = useState<Record<string, boolean>>(() =>
		getInitialOpenState(MOCK_STUDY_PLAN),
	);

	const summary = useMemo(() => getPlanSummary(years), [years]);
	const plannedTitles = useMemo(() => collectPlannedTitles(years), [years]);

	const isAllExpanded = years.every((year) => openState[year.key]);
	const toggleAll = useCallback(() => {
		const next = !isAllExpanded;
		setOpenState(Object.fromEntries(years.map((year) => [year.key, next])));
	}, [isAllExpanded, years]);

	const context: SemesterContext = {
		catalog: MOCK_COURSE_CATALOG,
		plannedTitles,
		electiveAvailable: summary.electiveAvailable,
		actions,
	};

	return (
		<Layout>
			<div className="mx-auto max-w-5xl space-y-8">
				<StudyPlanHeader
					subtitle={`${MOCK_STUDENT.level} · ${MOCK_STUDENT.program} · ${MOCK_STUDENT.courseNumber} курс`}
					summary={summary}
					isAllExpanded={isAllExpanded}
					onToggleExpandAll={toggleAll}
				/>

				<div className="space-y-8">
					{years.map((year) => (
						<StudyPlanYearSection
							key={year.key}
							year={year}
							isOpen={Boolean(openState[year.key])}
							onToggle={(open) =>
								setOpenState((prev) => ({ ...prev, [year.key]: open }))
							}
							context={context}
						/>
					))}
				</div>

				<StudyPlanSummary summary={summary} />
			</div>
		</Layout>
	);
}

export const Route = createFileRoute("/study-plan")({
	component: withAuth(StudyPlan),
});
