import type { ReactNode } from "react";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import type { PlanActions } from "../hooks/usePlannedCourses";
import {
	formatPlanCredits,
	getSemesterTitle,
	PLAN_KIND_ORDER,
	PLAN_KIND_STYLES,
} from "../planFormatting";
import { sumCredits, sumWeeklyHours } from "../planRules";
import type { PlanCourseKind, PlanSemester, PlanTerm } from "../planTypes";
import { PlanBackupRow, PlanCourseRow } from "./PlanCourseRow";

// Cells run column by column, one column per semester: stacked semesters on
// phones, and on wider screens rows that line up kinds across semesters,
// each kind opened by a header row spanning all three. Static classes so
// Tailwind keeps them.
const ROW_COUNT_CLASSES: Record<number, string> = {
	1: "md:grid-rows-[repeat(1,auto)]",
	2: "md:grid-rows-[repeat(2,auto)]",
	3: "md:grid-rows-[repeat(3,auto)]",
	4: "md:grid-rows-[repeat(4,auto)]",
	5: "md:grid-rows-[repeat(5,auto)]",
	6: "md:grid-rows-[repeat(6,auto)]",
	7: "md:grid-rows-[repeat(7,auto)]",
	8: "md:grid-rows-[repeat(8,auto)]",
};

/** The semester whose cell carries the header label, centring it on wide screens. */
const LABEL_COLUMN = 1;

interface PlanSemesterGridProps {
	readonly studyYear: number;
	readonly semesters: readonly PlanSemester[];
	readonly showBackups: boolean;
	/** Present only for planned years. */
	readonly actions?: PlanActions;
	readonly onAddCourse?: (term: PlanTerm) => void;
}

export function PlanSemesterGrid({
	studyYear,
	semesters,
	showBackups,
	actions,
	onAddCourse,
}: PlanSemesterGridProps) {
	const visible = (semester: PlanSemester) => ({
		main: semester.main,
		backup: showBackups ? semester.backup : [],
	});
	const kinds = PLAN_KIND_ORDER.filter((kind) =>
		semesters.some((semester) => {
			const { main, backup } = visible(semester);
			return [...main, ...backup].some((course) => course.kind === kind);
		}),
	);
	const rowCount = 1 + kinds.length * 2 + (onAddCourse ? 1 : 0);
	const yearMain = semesters.flatMap((semester) => semester.main);

	return (
		<div
			className={cn(
				"grid gap-x-4 gap-y-3.5 md:grid-flow-col md:grid-cols-3",
				ROW_COUNT_CLASSES[rowCount],
			)}
		>
			{semesters.map((semester, column) => {
				const target = { studyYear, term: semester.term };
				const { main, backup } = visible(semester);
				return [
					<SemesterHeading key="heading" semester={semester} />,
					...kinds.flatMap((kind) => {
						const kindMain = main.filter((course) => course.kind === kind);
						const kindBackup = backup.filter((course) => course.kind === kind);
						const isEmpty = kindMain.length + kindBackup.length === 0;
						return [
							<KindHeader
								key={`${kind}-header`}
								kind={kind}
								credits={sumCredits(
									yearMain.filter((course) => course.kind === kind),
								)}
								labelled={column === LABEL_COLUMN}
								lastColumn={column === semesters.length - 1}
								isEmpty={isEmpty}
							/>,
							<KindCell key={kind} isEmpty={isEmpty}>
								{kindMain.map((course) => {
									// Only the student's own picks can move or go.
									const ownPick =
										actions && course.kind !== "COMPULSORY" && !course.locked;
									return (
										<PlanCourseRow
											key={course.courseId}
											course={course}
											onRemove={
												ownPick
													? () => actions.remove(target, course.courseId)
													: undefined
											}
										/>
									);
								})}
								{kindBackup.map((course) => (
									<PlanBackupRow
										key={course.courseId}
										course={course}
										onPromote={
											actions
												? () => actions.promote(target, course.courseId)
												: undefined
										}
										onRemove={
											actions
												? () => actions.remove(target, course.courseId)
												: undefined
										}
									/>
								))}
							</KindCell>,
						];
					}),
					onAddCourse ? (
						<AddCell
							key="add"
							semester={semester}
							onAdd={() => onAddCourse(semester.term)}
						/>
					) : null,
				];
			})}
		</div>
	);
}

function SemesterHeading({ semester }: Readonly<{ semester: PlanSemester }>) {
	return (
		<div className="mt-4 flex items-baseline justify-between border-b px-0.5 pb-2 first:mt-0 md:mt-0">
			<h3 className="text-sm font-semibold">
				{getSemesterTitle(semester.term)}
			</h3>
			{semester.unavailable ? null : (
				<span className="text-sm text-muted-foreground tabular-nums">
					{formatPlanCredits(sumCredits(semester.main))} ECTS /{" "}
					{sumWeeklyHours(semester.main)} год
				</span>
			)}
		</div>
	);
}

/**
 * One semester's share of a kind's header row: a line that, with its
 * neighbours, spans all three semesters, labelled in the middle one. Phones
 * stack semesters, so there each semester with such courses labels its own.
 */
function KindHeader({
	kind,
	credits,
	labelled,
	lastColumn,
	isEmpty,
}: Readonly<{
	kind: PlanCourseKind;
	credits: number;
	labelled: boolean;
	lastColumn: boolean;
	isEmpty: boolean;
}>) {
	const style = PLAN_KIND_STYLES[kind];
	return (
		<div
			className={cn(
				"items-center gap-3 pt-2",
				isEmpty ? "hidden md:flex" : "flex",
				// Stretch over the column gap so the line runs unbroken.
				!lastColumn && "md:-mr-4",
			)}
		>
			<span
				aria-hidden
				className={cn("hidden h-px grow opacity-40 md:block", style.dot)}
			/>
			<span
				className={cn(
					"flex shrink-0 items-center gap-1 text-sm font-semibold",
					style.text,
					!labelled && "md:hidden",
				)}
			>
				{style.groupLabel}
				<span className="font-normal tabular-nums opacity-75">
					· {formatPlanCredits(credits)} ECTS
				</span>
			</span>
			<span aria-hidden className={cn("h-px grow opacity-40", style.dot)} />
		</div>
	);
}

function KindCell({
	isEmpty,
	children,
}: Readonly<{ isEmpty: boolean; children: ReactNode }>) {
	return (
		<div className={cn("flex-col gap-2", isEmpty ? "hidden md:flex" : "flex")}>
			{children}
		</div>
	);
}

function AddCell({
	semester,
	onAdd,
}: Readonly<{ semester: PlanSemester; onAdd: () => void }>) {
	if (semester.unavailable) {
		return (
			<p className="rounded-lg border border-dashed px-3 py-2.5 text-center text-sm text-muted-foreground">
				На останньому курсі літнього семестру немає
			</p>
		);
	}
	return (
		<Button
			variant="outline"
			size="sm"
			onClick={onAdd}
			className="border-dashed text-muted-foreground shadow-none"
			data-testid={testIds.personalPlan.addCourseButton}
		>
			<Plus aria-hidden />
			Додати дисципліну
		</Button>
	);
}
