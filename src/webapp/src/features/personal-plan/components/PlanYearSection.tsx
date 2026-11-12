import { ChevronDown } from "lucide-react";

import { Card } from "@/components/ui/Card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import { formatAcademicYearLabel } from "@/features/courses/courseFormatting";
import { testIds } from "@/lib/test-ids";
import type { PlanYear, SemesterTermEnum } from "@/lib/api/generated";
import type { PlanActions } from "../hooks/usePlanActions";
import { formatPlanCredits } from "../planFormatting";
import { yearCredits } from "../planRules";
import { PlanSemesterGrid } from "./PlanSemesterGrid";

interface PlanYearSectionProps {
	readonly year: PlanYear;
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly showBackups: boolean;
	readonly actions: PlanActions;
	readonly onAddCourse: (studyYear: number, term: SemesterTermEnum) => void;
}

export function PlanYearSection({
	year,
	open,
	onOpenChange,
	showBackups,
	actions,
	onAddCourse,
}: PlanYearSectionProps) {
	const studyYear = year.study_year ?? 0;
	const title = `${studyYear} курс`;
	// Past years are settled; the current one can still take new picks.
	const editable = year.year_status !== "done";

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
								{formatAcademicYearLabel(year.academic_year_start, "FALL")}
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
							studyYear={studyYear}
							semesters={year.semesters ?? []}
							showBackups={showBackups}
							actions={editable ? actions : undefined}
							onAddCourse={
								editable ? (term) => onAddCourse(studyYear, term) : undefined
							}
						/>
					</CollapsibleContent>
				</section>
			</Card>
		</Collapsible>
	);
}
