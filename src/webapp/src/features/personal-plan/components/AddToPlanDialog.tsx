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
import type { CourseOffering } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { usePersonalPlan } from "../hooks/usePersonalPlan";
import {
	formatPlanCredits,
	getSemesterTitle,
	PLAN_KIND_STYLES,
} from "../planFormatting";
import { courseKindFor, offeringForTerm, offeringLoad } from "../planOffering";
import type { PlannedPlace } from "../planStore";
import { isPlanTerm } from "../planTimeline";
import type {
	PlanCourse,
	PlanSlot,
	PlanTarget,
	PlanTerm,
	PlanYear,
} from "../planTypes";
import type { PlanCandidate } from "./AddToPlanButton";

/** Terms the course has run in; empty when the catalog does not say. */
function offeredTerms(offerings: readonly CourseOffering[]): Set<PlanTerm> {
	const terms = offerings.flatMap((offering) => [
		offering.semester_term?.toUpperCase(),
		...(offering.terms ?? []).map((term) => term.semester_term?.toUpperCase()),
	]);
	return new Set(terms.filter(isPlanTerm));
}

const sameTarget = (a: PlanTarget, b: PlanTarget) =>
	a.studyYear === b.studyYear && a.term === b.term;

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
	const canGo = (term: PlanTerm) => runsIn.size === 0 || runsIn.has(term);
	// Only semesters still to come that exist and in which the course runs.
	const years = plan.years
		.filter((year) => year.status !== "done")
		.map((year) => ({
			...year,
			semesters: year.semesters.filter(
				(semester) => !semester.unavailable && canGo(semester.term),
			),
		}))
		.filter((year) => year.semesters.length > 0);
	const firstOpen = years
		.flatMap((year) =>
			year.semesters.map((semester) => ({
				studyYear: year.studyYear,
				term: semester.term,
			})),
		)
		.at(0);

	const [picked, setPicked] = useState<PlanTarget | null>(null);
	const [slot, setSlot] = useState<PlanSlot>(place?.slot ?? "main");
	const target = picked ?? place?.target ?? firstOpen ?? null;

	const takenIn = plan.years.find((year) =>
		year.semesters.some((semester) =>
			semester.main.some(
				(item) => item.courseId === course.courseId && item.locked,
			),
		),
	);

	const kind = courseKindFor(course.specialities, speciality?.id);
	const load = target
		? offeringLoad(offeringForTerm(course.offerings, target.term), target.term)
		: null;

	const save = () => {
		if (!target || !load) return;
		const planCourse: PlanCourse = {
			courseId: course.courseId,
			title: course.title,
			kind,
			facultyName: course.facultyName,
			...load,
		};
		if (place && !sameTarget(place.target, target)) {
			plan.actions.remove(place.target, course.courseId);
		}
		plan.actions.add(target, planCourse, slot);
		onDone();
		toast.success(
			`${place ? "Перенесено" : "Додано"} в ІНП: ${target.studyYear} курс, ${getSemesterTitle(target.term).toLowerCase()}`,
			{
				action: {
					label: "Відкрити ІНП",
					onClick: () => navigate({ to: "/plan" }),
				},
			},
		);
	};

	const remove = () => {
		if (!place) return;
		plan.actions.remove(place.target, course.courseId);
		onDone();
		toast.success("Прибрано з ІНП");
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
					Цей курс уже є у вашому ІНП за даними САЗ ({takenIn.studyYear} курс).
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
									key={year.studyYear}
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
							<ToggleGroupItem value="main">Основна</ToggleGroupItem>
							<ToggleGroupItem value="backup">Запасна</ToggleGroupItem>
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
					<Button variant="ghost" className="text-destructive" onClick={remove}>
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
						disabled={plan.isLoading || Boolean(takenIn) || !target}
					>
						{place ? "Зберегти" : "Додати"}
					</Button>
				</div>
			</DialogFooter>
		</>
	);
}

/** Calendar year a semester falls in: autumn opens the academic year. */
const calendarYear = (academicYearStart: number, term: PlanTerm) =>
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
	year: PlanYear;
	selected: PlanTarget | null;
	/** To show the course's own load in each term. */
	offerings: readonly CourseOffering[];
	onPick: (target: PlanTarget) => void;
}>) {
	return (
		<div className="space-y-1.5">
			<p className="text-xs font-medium text-muted-foreground">
				{year.studyYear} курс ·{" "}
				{formatAcademicYearLabel(year.academicYearStart, "FALL")}
			</p>
			{year.semesters.map((semester) => {
				const isSelected =
					selected?.studyYear === year.studyYear &&
					selected.term === semester.term;
				return (
					<label
						key={semester.term}
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
								onPick({ studyYear: year.studyYear, term: semester.term })
							}
						/>
						<span className="min-w-0 grow">
							<span className="block text-sm font-medium">
								{getSemesterTermDisplay(semester.term)}{" "}
								{calendarYear(year.academicYearStart, semester.term)}
							</span>
						</span>
						<span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">
							<SemesterLoad offerings={offerings} term={semester.term} />
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
}: Readonly<{ offerings: readonly CourseOffering[]; term: PlanTerm }>) {
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
