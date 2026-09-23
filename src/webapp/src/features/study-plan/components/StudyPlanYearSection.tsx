import { ChevronDown, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/Collapsible";
import {
	formatCredits,
	getYearCredits,
	getYearLoadStatus,
	isYearEditable,
	YEAR_MAX_CREDITS,
	YEAR_MIN_CREDITS,
	type YearLoadStatus,
} from "@/features/study-plan/studyPlanRules";
import type {
	PlanSemester,
	PlanYear,
	PlanYearStatus,
} from "@/features/study-plan/studyPlanTypes";
import { cn } from "@/lib/utils";
import { LoadStat } from "./LoadStat";
import { type SemesterContext, StudyPlanSemester } from "./StudyPlanSemester";

interface StudyPlanYearSectionProps {
	year: PlanYear;
	isOpen: boolean;
	onToggle: (open: boolean) => void;
	context: SemesterContext;
}

export function StudyPlanYearSection({
	year,
	isOpen,
	onToggle,
	context,
}: Readonly<StudyPlanYearSectionProps>) {
	const isEditable = isYearEditable(year);
	const credits = getYearCredits(year);
	const visibleSemesters = year.semesters.filter((semester) =>
		isSemesterVisible(semester, isEditable),
	);
	const unavailableSummer = year.semesters.find((s) => s.isUnavailable);

	return (
		<Collapsible open={isOpen} onOpenChange={onToggle} asChild>
			<section className="space-y-3">
				<CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-md px-1 py-1 text-left hover:bg-muted/50 transition-colors cursor-pointer">
					{isOpen ? (
						<ChevronDown className="size-4 text-muted-foreground shrink-0" />
					) : (
						<ChevronRight className="size-4 text-muted-foreground shrink-0" />
					)}
					<h2 className="text-xl font-semibold text-foreground">
						{year.courseNumber} курс
					</h2>
					<span className="text-sm text-muted-foreground">
						{year.academicYear}
					</span>
					<YearStatusBadge status={year.status} />
				</CollapsibleTrigger>

				<CollapsibleContent>
					<div className="grid gap-3 lg:grid-cols-2">
						{visibleSemesters.map((semester) => (
							<div
								key={semester.key}
								className={cn(
									"[&>section]:h-full",
									semester.season === "SUMMER" && "lg:col-span-2",
								)}
							>
								<StudyPlanSemester
									semester={semester}
									isEditable={isEditable}
									context={context}
								/>
							</div>
						))}
						{unavailableSummer && (
							<p className="lg:col-span-2 rounded-lg border border-dashed border-border/70 px-4 py-2.5 text-sm text-muted-foreground">
								Літнього семестру на {year.courseNumber} курсі немає — запис на
								нього недоступний
							</p>
						)}
					</div>
				</CollapsibleContent>

				<YearTotal
					credits={credits}
					status={isEditable ? getYearLoadStatus(credits) : null}
				/>
			</section>
		</Collapsible>
	);
}

function isSemesterVisible(semester: PlanSemester, isEditable: boolean) {
	if (semester.isUnavailable) return false;
	if (semester.season !== "SUMMER") return true;
	return isEditable || semester.courses.length > 0;
}

const STATUS_BADGES: Record<
	PlanYearStatus,
	{ label: string; className: string }
> = {
	completed: {
		label: "Завершено",
		className: "text-muted-foreground border-muted-foreground/20 bg-muted/5",
	},
	current: {
		label: "Поточний",
		className: "bg-primary/10 text-primary border-primary/20",
	},
	planned: {
		label: "Планування",
		className: "text-foreground border-border",
	},
};

function YearStatusBadge({ status }: Readonly<{ status: PlanYearStatus }>) {
	const badge = STATUS_BADGES[status];
	return (
		<Badge
			variant="outline"
			className={cn("h-5 px-1.5 text-[10px]", badge.className)}
		>
			{badge.label}
		</Badge>
	);
}

interface YearTotalProps {
	credits: number;
	status: YearLoadStatus | null;
}

function YearTotal({ credits, status }: Readonly<YearTotalProps>) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-4 py-2.5 text-sm">
			<div className="flex items-center gap-3">
				<span className="font-medium text-foreground">Разом за рік</span>
				{status && <YearLoadHint status={status} />}
			</div>
			<LoadStat credits={credits} />
		</div>
	);
}

function YearLoadHint({ status }: Readonly<{ status: YearLoadStatus }>) {
	if (status.kind === "under") {
		return (
			<span className="text-xs text-difficulty-foreground dark:text-difficulty">
				ще {formatCredits(status.missing)} до мінімуму {YEAR_MIN_CREDITS}
			</span>
		);
	}
	if (status.kind === "over") {
		return (
			<span className="text-xs text-destructive">
				понад максимум {YEAR_MAX_CREDITS} на {formatCredits(status.excess)}
			</span>
		);
	}
	return (
		<span className="text-xs text-muted-foreground">
			у межах {YEAR_MIN_CREDITS}–{YEAR_MAX_CREDITS} кр.
		</span>
	);
}
