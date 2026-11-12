import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { ArrowUp, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { formatPlanCredits, PLAN_KIND_STYLES } from "../planFormatting";
import type { PlanCourse } from "../planTypes";

function CourseLoad({ course }: Readonly<{ course: PlanCourse }>) {
	return (
		<span className="whitespace-nowrap text-sm font-semibold tabular-nums">
			{formatPlanCredits(course.credits)}{" "}
			<span className="text-xs font-normal text-muted-foreground">ECTS</span>
			<span className="text-xs font-normal text-muted-foreground/60"> / </span>
			{course.weeklyHours ?? "—"}{" "}
			<span className="text-xs font-normal text-muted-foreground">год</span>
		</span>
	);
}

function RowAction({
	label,
	onClick,
	className,
	children,
}: Readonly<{
	label: string;
	onClick: () => void;
	className?: string;
	children: ReactNode;
}>) {
	return (
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label={label}
			title={label}
			onClick={onClick}
			className={cn("size-7 text-muted-foreground", className)}
		>
			{children}
		</Button>
	);
}

/** The course kind as a colored stripe on the row's left edge. */
function KindStripe({
	course,
	faded = false,
}: Readonly<{ course: PlanCourse; faded?: boolean }>) {
	const style = PLAN_KIND_STYLES[course.kind];
	return (
		<>
			<span
				aria-hidden
				className={cn(
					"absolute inset-y-0 left-0 w-1",
					style.dot,
					faded && "opacity-50",
				)}
			/>
			<span className="sr-only">{style.groupLabel}: </span>
		</>
	);
}

interface PlanCourseRowProps {
	readonly course: PlanCourse;
	/** Absent when the row is read-only or the course is compulsory. */
	readonly onRemove?: () => void;
}

export function PlanCourseRow({ course, onRemove }: PlanCourseRowProps) {
	return (
		<div
			className="relative flex min-h-11 items-center gap-2.5 overflow-hidden rounded-lg border bg-muted/50 py-1.5 pr-2 pl-4"
			data-testid={testIds.personalPlan.courseRow}
		>
			<KindStripe course={course} />
			<Link
				to="/courses/$courseId"
				params={{ courseId: course.courseId }}
				className="min-w-0 grow text-sm leading-snug font-medium hover:text-primary"
			>
				{course.title}
			</Link>
			<CourseLoad course={course} />
			{onRemove ? (
				<RowAction label={`Прибрати ${course.title}`} onClick={onRemove}>
					<X className="size-3.5" />
				</RowAction>
			) : null}
		</div>
	);
}

interface PlanBackupRowProps {
	readonly course: PlanCourse;
	readonly onPromote?: () => void;
	readonly onRemove?: () => void;
}

export function PlanBackupRow({
	course,
	onPromote,
	onRemove,
}: PlanBackupRowProps) {
	return (
		<div
			className="relative flex min-h-11 items-center gap-2.5 overflow-hidden rounded-lg border border-dashed bg-background py-1.5 pr-2 pl-4"
			data-testid={testIds.personalPlan.backupRow}
		>
			<KindStripe course={course} faded />
			<span className="min-w-0 grow text-sm leading-snug font-medium text-muted-foreground">
				{course.title}
			</span>
			<span className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">
				{formatPlanCredits(course.credits)}{" "}
				<span className="text-xs">ECTS</span> / {course.weeklyHours ?? "—"}{" "}
				<span className="text-xs">год</span>
			</span>
			{onPromote ? (
				<RowAction
					label={`Зробити основною: ${course.title}`}
					onClick={onPromote}
					className="text-primary"
				>
					<ArrowUp className="size-3.5" />
				</RowAction>
			) : null}
			{onRemove ? (
				<RowAction label={`Прибрати ${course.title}`} onClick={onRemove}>
					<X className="size-3.5" />
				</RowAction>
			) : null}
		</div>
	);
}
