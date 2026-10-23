import { ChevronDown } from "lucide-react";

import { Card } from "@/components/ui/Card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { formatAcademicYearLabel } from "@/features/courses/courseFormatting";
import { testIds } from "@/lib/test-ids";
import type { PlanActions } from "../hooks/usePlannedCourses";
import { formatPlanCredits } from "../planFormatting";
import { yearCredits } from "../planRules";
import type { PlanTerm, PlanYear } from "../planTypes";
import { PlanSemesterGrid } from "./PlanSemesterGrid";

interface PlanYearSectionProps {
	readonly year: PlanYear;
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly showBackups: boolean;
	readonly actions: PlanActions;
	readonly onAddCourse: (studyYear: number, term: PlanTerm) => void;
}

export function PlanYearSection({
	year,
	open,
	onOpenChange,
	showBackups,
	actions,
	onAddCourse,
}: PlanYearSectionProps) {
	const title = `${year.studyYear} курс`;
	// Past years are settled; the current one can still take new picks.
	const editable = year.status !== "done";

	return (
		<Collapsible open={open} onOpenChange={onOpenChange} asChild>
			<Card asChild>
				<section
					aria-label={title}
					data-testid={testIds.personalPlan.yearSection}
				>
					<CollapsibleTrigger className="group flex w-full items-center gap-4 rounded-xl px-5 py-4 text-left">
						<ChevronDown
							aria-hidden
							className="size-4.5 shrink-0 -rotate-90 text-muted-foreground transition-transform group-data-[state=open]:rotate-0"
						/>
						<span className="flex min-w-36 grow items-baseline gap-2.5">
							<span className="text-lg font-semibold">{title}</span>
							<span className="text-sm text-muted-foreground">
								{formatAcademicYearLabel(year.academicYearStart, "FALL")}
							</span>
						</span>
						<span className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
							<strong className="text-foreground">
								{formatPlanCredits(yearCredits(year))}
							</strong>{" "}
							ECTS
						</span>
					</CollapsibleTrigger>
					<CollapsibleContent className="px-5 pt-1 pb-5">
						<PlanSemesterGrid
							studyYear={year.studyYear}
							semesters={year.semesters}
							showBackups={showBackups}
							actions={editable ? actions : undefined}
							onAddCourse={
								editable
									? (term) => onAddCourse(year.studyYear, term)
									: undefined
							}
						/>
					</CollapsibleContent>
				</section>
			</Card>
		</Collapsible>
	);
}
