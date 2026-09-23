import { ArrowUpToLine, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { formatCredits } from "@/features/study-plan/studyPlanRules";
import type { PlanCourse } from "@/features/study-plan/studyPlanTypes";
import { cn } from "@/lib/utils";
import { CategoryDot } from "./CategoryDot";

interface StudyPlanCourseRowProps {
	course: PlanCourse;
	isEditable: boolean;
	isBackup?: boolean;
	onRemove?: () => void;
	onPromote?: () => void;
}

export function StudyPlanCourseRow({
	course,
	isEditable,
	isBackup = false,
	onRemove,
	onPromote,
}: Readonly<StudyPlanCourseRowProps>) {
	const isCompulsory = course.category === "COMPULSORY";
	const canRemove = isEditable && !isCompulsory;

	return (
		<li
			className={cn(
				"group flex items-center gap-2.5 rounded-md px-2 h-9 transition-colors hover:bg-muted/50",
				isBackup && "text-muted-foreground",
			)}
		>
			<CategoryDot category={course.category} />
			<span className="flex-1 min-w-0 truncate text-sm">{course.title}</span>

			<RowActions
				isBackup={isBackup}
				canRemove={canRemove}
				onRemove={onRemove}
				onPromote={onPromote}
			/>

			<span className="w-12 text-right text-sm tabular-nums text-muted-foreground shrink-0">
				{formatCredits(course.credits)}
			</span>
		</li>
	);
}

interface RowActionsProps {
	isBackup: boolean;
	canRemove: boolean;
	onRemove?: () => void;
	onPromote?: () => void;
}

function RowActions({
	isBackup,
	canRemove,
	onRemove,
	onPromote,
}: Readonly<RowActionsProps>) {
	if (!canRemove) return null;

	return (
		<div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity shrink-0">
			{isBackup && onPromote && (
				<Tooltip>
					<TooltipTrigger asChild>
						<Button
							variant="ghost"
							size="icon-sm"
							className="size-7"
							onClick={onPromote}
							aria-label="Перенести в основні"
						>
							<ArrowUpToLine className="size-3.5" />
						</Button>
					</TooltipTrigger>
					<TooltipContent>Перенести в основні</TooltipContent>
				</Tooltip>
			)}
			<Button
				variant="ghost"
				size="icon-sm"
				className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
				onClick={onRemove}
				aria-label="Прибрати з плану"
			>
				<X className="size-3.5" />
			</Button>
		</div>
	);
}
