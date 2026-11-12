import { useState } from "react";

import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import {
	formatAcademicYearLabel,
	getSemesterTermDisplay,
} from "@/features/courses/courseFormatting";
import type {
	CourseOffering,
	PlanSlot,
	PlanYear,
	SemesterTermEnum,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { usePersonalPlan } from "../hooks/usePersonalPlan";
import type { PlanTarget } from "../hooks/usePlanActions";
import {
	formatPlanCredits,
	getSemesterTitle,
	PLAN_KIND_STYLES,
} from "../planFormatting";
import { courseKindFor, offeringForTerm, offeringLoad } from "../planOffering";
import { isPlanTerm, type PlannedPlace } from "../planTimeline";
import type { PlanCandidate } from "./AddToPlanButton";

/** Terms the course has run in; empty when the catalog does not say. */
function offeredTerms(
	offerings: readonly CourseOffering[],
): Set<SemesterTermEnum> {
	const terms = offerings.flatMap((offering) => [
		offering.semester_term?.toUpperCase(),
		...(offering.terms ?? []).map((term) => term.semester_term?.toUpperCase()),
	]);
	return new Set(terms.filter(isPlanTerm));
}

interface AddToPlanDialogProps {
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly course: PlanCandidate;
	/** Where the course already is, to move it rather than add it twice. */
	readonly place: PlannedPlace | null;
}

export function AddToPlanDialog({
	open,
	onOpenChange,
	...props
}: AddToPlanDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="sm:max-w-lg"
				data-testid={testIds.personalPlan.addToPlanDialog}
			>
				{/* Mounted only while open: the plan loads САЗ history. */}
				{open ? (
					<AddToPlanBody {...props} onDone={() => onOpenChange(false)} />
				) : null}
			</DialogContent>
		</Dialog>
	);
}

function AddToPlanBody({
	course,
	place,
	onDone,
}: Readonly<
	Omit<AddToPlanDialogProps, "open" | "onOpenChange"> & {
		onDone: () => void;
	}
>) {
	const plan = usePersonalPlan({ enabled: true });
	const { speciality } = useAuth();
	const navigate = useNavigate();

	const runsIn = offeredTerms(course.offerings);
	const canGo = (term: SemesterTermEnum | undefined) =>
		runsIn.size === 0 || (term !== undefined && runsIn.has(term));
	// Only semesters still to come that exist and in which the course runs.
	const years = plan.years
		.filter((year) => year.year_status !== "done")
		.map((year) => ({
			...year,
			semesters: (year.semesters ?? []).filter(
				(semester) =>
					!semester.is_graduation_summer && canGo(semester.semester_term),
			),
		}))
		.filter((year) => year.semesters.length > 0);
	const firstOpen = years
		.flatMap((year) =>
			year.semesters.map((semester) => ({
				study_year: year.study_year ?? 0,
				semester_term: semester.semester_term ?? "FALL",
			})),
		)
		.at(0);

	const [picked, setPicked] = useState<PlanTarget | null>(null);
	const [slot, setSlot] = useState<PlanSlot>(place?.slot ?? "MAIN");
	const target = picked ?? place?.target ?? firstOpen ?? null;

	const takenIn = plan.years.find((year) =>
		(year.semesters ?? []).some((semester) =>
			(semester.main ?? []).some(
				(item) => item.course_id === course.courseId && item.is_mandatory,
			),
		),
	);

	const kind = courseKindFor(course.specialities, speciality?.id);
	const load = target
		? offeringLoad(
				offeringForTerm(course.offerings, target.semester_term),
				target.semester_term,
			)
		: null;

	const save = () => {
		if (!target) return;
		plan.actions.add(target, course.courseId, slot, () => {
			onDone();
			toast.success(
				`${place ? "Перенесено" : "Додано"} в ІНП: ${target.study_year} курс, ${getSemesterTitle(target.semester_term).toLowerCase()}`,
				{
					action: {
						label: "Відкрити ІНП",
						onClick: () => navigate({ to: "/plan" }),
					},
				},
			);
		});
	};

	const remove = () => {
		if (!place) return;
		plan.actions.remove(course.courseId, () => {
			onDone();
			toast.success("Прибрано з ІНП");
		});
	};

	return (
		<>
			<DialogHeader>
				<DialogTitle>{place ? "Змінити в ІНП" : "Додати в ІНП"}</DialogTitle>
				<DialogDescription>{course.title}</DialogDescription>
			</DialogHeader>

			{plan.isLoading ? (
				<div className="space-y-2" aria-busy="true">
					<Skeleton className="h-16" />
					<Skeleton className="h-16" />
				</div>
			) : takenIn ? (
				<p className="text-sm text-muted-foreground">
					Цей курс обов'язковий або вже пройдений, тому він є у вашому ІНП (
					{takenIn.study_year} курс).
				</p>
			) : years.length === 0 ? (
				<p className="text-sm text-muted-foreground">
					Курс не викладається в жодному семестрі, який ще можна запланувати.
				</p>
			) : (
				<div className="space-y-5">
					<fieldset>
						<legend className="mb-2 text-sm font-medium">У який семестр</legend>
						<div className="max-h-72 space-y-3 overflow-y-auto pr-1">
							{years.map((year) => (
								<YearSemesters
									key={year.study_year}
									year={year}
									selected={target}
									offerings={course.offerings}
									onPick={setPicked}
								/>
							))}
						</div>
					</fieldset>

					<div className="space-y-2">
						<span className="text-sm font-medium">Як</span>
						<ToggleGroup
							type="single"
							variant="outline"
							size="sm"
							value={slot}
							onValueChange={(value: PlanSlot | "") => {
								if (value) setSlot(value);
							}}
							aria-label="Основна чи запасна"
						>
							<ToggleGroupItem value="MAIN">Основна</ToggleGroupItem>
							<ToggleGroupItem value="BACKUP">Запасна</ToggleGroupItem>
						</ToggleGroup>
						<p className="text-xs text-muted-foreground">
							Запасні не входять у підрахунок кредитів.
						</p>
					</div>

					{load ? (
						<p className="text-sm">
							<span className={cn("font-medium", PLAN_KIND_STYLES[kind].text)}>
								{PLAN_KIND_STYLES[kind].groupLabel}
							</span>
							<span className="text-muted-foreground tabular-nums">
								{" · "}
								{formatPlanCredits(load.credits)} ECTS /{" "}
								{load.weeklyHours ?? "—"} год
							</span>
						</p>
					) : null}
				</div>
			)}

			<DialogFooter className="sm:justify-between">
				{place && !takenIn ? (
					<Button
						variant="ghost"
						className="text-destructive"
						disabled={plan.actions.isSaving}
						onClick={remove}
					>
						Прибрати з ІНП
					</Button>
				) : (
					<span />
				)}
				<div className="flex flex-col-reverse gap-2 sm:flex-row">
					<Button variant="outline" onClick={onDone}>
						Скасувати
					</Button>
					<Button
						onClick={save}
						disabled={
							plan.isLoading ||
							plan.actions.isSaving ||
							Boolean(takenIn) ||
							!target
						}
					>
						{place ? "Зберегти" : "Додати"}
					</Button>
				</div>
			</DialogFooter>
		</>
	);
}

/** Calendar year a semester falls in: autumn opens the academic year. */
const calendarYear = (academicYearStart: number, term: SemesterTermEnum) =>
	term === "FALL" ? academicYearStart : academicYearStart + 1;

/**
 * One year's semesters as a list of options, each with the course's credits
 * and hours in that term, which can differ between autumn and spring.
 */
function YearSemesters({
	year,
	selected,
	offerings,
	onPick,
}: Readonly<{
	year: PlanYear & { semesters: NonNullable<PlanYear["semesters"]> };
	selected: PlanTarget | null;
	/** To show the course's own load in each term. */
	offerings: readonly CourseOffering[];
	onPick: (target: PlanTarget) => void;
}>) {
	const studyYear = year.study_year ?? 0;
	const academicYearStart = year.academic_year_start ?? 0;
	return (
		<div className="space-y-1.5">
			<p className="text-xs font-medium text-muted-foreground">
				{studyYear} курс · {formatAcademicYearLabel(academicYearStart, "FALL")}
			</p>
			{year.semesters.map((semester) => {
				const term = semester.semester_term ?? "FALL";
				const isSelected =
					selected?.study_year === studyYear && selected.semester_term === term;
				return (
					<label
						key={term}
						className={cn(
							"flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent/50",
							isSelected && "border-primary/50 bg-primary/5",
						)}
					>
						<input
							type="radio"
							name="plan-semester"
							className="size-4 accent-primary"
							checked={isSelected}
							onChange={() =>
								onPick({ study_year: studyYear, semester_term: term })
							}
						/>
						<span className="min-w-0 grow">
							<span className="block text-sm font-medium">
								{getSemesterTermDisplay(term)}{" "}
								{calendarYear(academicYearStart, term)}
							</span>
						</span>
						<span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
							<SemesterLoad offerings={offerings} term={term} />
						</span>
					</label>
				);
			})}
		</div>
	);
}

function SemesterLoad({
	offerings,
	term,
}: Readonly<{ offerings: readonly CourseOffering[]; term: SemesterTermEnum }>) {
	const { credits, weeklyHours } = offeringLoad(
		offeringForTerm(offerings, term),
		term,
	);
	return (
		<>
			{formatPlanCredits(credits)} ECTS / {weeklyHours ?? "—"} год
		</>
	);
}
