import { useState } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import type { StudyPlanActions } from "@/features/study-plan/hooks/useStudyPlanState";
import {
	getSemesterCredits,
	SEASON_LABELS,
} from "@/features/study-plan/studyPlanRules";
import type {
	PlanCourse,
	PlanCourseCategory,
	PlanSemester,
} from "@/features/study-plan/studyPlanTypes";
import { AddCourseCombobox } from "./AddCourseCombobox";
import { LoadStat } from "./LoadStat";
import { StudyPlanCourseRow } from "./StudyPlanCourseRow";

const CATEGORY_ORDER: Record<PlanCourseCategory, number> = {
	COMPULSORY: 0,
	PROF_ORIENTED: 1,
	ELECTIVE: 2,
};

function sortCourses(courses: readonly PlanCourse[]): PlanCourse[] {
	return [...courses].sort(
		(a, b) =>
			CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
			a.title.localeCompare(b.title, "uk"),
	);
}

export interface SemesterContext {
	catalog: readonly PlanCourse[];
	plannedTitles: ReadonlySet<string>;
	electiveAvailable: number;
	actions: StudyPlanActions;
}

interface StudyPlanSemesterProps {
	semester: PlanSemester;
	isEditable: boolean;
	context: SemesterContext;
}

export function StudyPlanSemester({
	semester,
	isEditable,
	context,
}: Readonly<StudyPlanSemesterProps>) {
	const { actions } = context;
	const credits = getSemesterCredits(semester);
	const isSummer = semester.season === "SUMMER";

	return (
		<section className="flex flex-col rounded-lg border border-border/60 bg-card">
			<header className="flex items-center justify-between px-4 pt-3 pb-2">
				<h3 className="text-sm font-medium text-foreground">
					{SEASON_LABELS[semester.season]}
				</h3>
				{isSummer && (
					<span className="text-xs text-muted-foreground">необов'язковий</span>
				)}
			</header>

			<ul className="flex-1 space-y-0.5 px-2">
				{sortCourses(semester.courses).map((course) => (
					<StudyPlanCourseRow
						key={course.id}
						course={course}
						isEditable={isEditable}
						onRemove={() => actions.removeCourse(semester.key, course.id)}
					/>
				))}
				{semester.courses.length === 0 && !isEditable && (
					<li className="px-2 h-9 flex items-center text-sm text-muted-foreground">
						Дисциплін немає
					</li>
				)}
			</ul>

			{isEditable && (
				<div className="px-2 pt-1">
					<AddCourseCombobox
						label="Додати дисципліну"
						catalog={context.catalog}
						excludedTitles={context.plannedTitles}
						electiveAvailable={context.electiveAvailable}
						onSelect={(course) =>
							actions.addCourse(semester.key, course, false)
						}
					/>
				</div>
			)}

			{isEditable && <BackupsSection semester={semester} context={context} />}

			<footer className="mt-2 flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-sm">
				<span className="text-muted-foreground">Навантаження</span>
				<LoadStat credits={credits} />
			</footer>
		</section>
	);
}

interface BackupsSectionProps {
	semester: PlanSemester;
	context: SemesterContext;
}

function BackupsSection({ semester, context }: Readonly<BackupsSectionProps>) {
	const [isOpen, setIsOpen] = useState(false);
	const { actions } = context;
	const count = semester.backups.length;

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen} className="px-2 pt-1">
			<CollapsibleTrigger className="flex items-center gap-1.5 rounded-md px-2 h-8 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
				{isOpen ? (
					<ChevronDown className="size-3.5" />
				) : (
					<ChevronRight className="size-3.5" />
				)}
				Запасні дисципліни
				{count > 0 && (
					<span className="rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums">
						{count}
					</span>
				)}
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="ml-2 mt-0.5 border-l border-dashed border-border pl-2">
					<p className="px-2 pb-1 text-xs text-muted-foreground/80">
						На випадок, якщо не вдасться записатися на основні. Не враховуються
						в кредитах.
					</p>
					<ul className="space-y-0.5">
						{semester.backups.map((course) => (
							<StudyPlanCourseRow
								key={course.id}
								course={course}
								isEditable
								isBackup
								onRemove={() => actions.removeCourse(semester.key, course.id)}
								onPromote={() => actions.promoteBackup(semester.key, course.id)}
							/>
						))}
					</ul>
					<AddCourseCombobox
						label="Додати запасну"
						variant="subtle"
						catalog={context.catalog}
						excludedTitles={context.plannedTitles}
						electiveAvailable={context.electiveAvailable}
						onSelect={(course) => actions.addCourse(semester.key, course, true)}
					/>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
