import { ListCollapse, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { CircularProgress } from "@/components/ui/CircularProgress";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import {
	BACHELOR_TOTAL_CREDITS,
	type PlanSummary,
} from "@/features/study-plan/studyPlanRules";
import { CategoryLegend } from "./CategoryDot";

interface StudyPlanHeaderProps {
	subtitle: string;
	summary: PlanSummary;
	isAllExpanded: boolean;
	onToggleExpandAll: () => void;
}

export function StudyPlanHeader({
	subtitle,
	summary,
	isAllExpanded,
	onToggleExpandAll,
}: Readonly<StudyPlanHeaderProps>) {
	const percentage = Math.round(
		(summary.totalCredits / BACHELOR_TOTAL_CREDITS) * 100,
	);
	const expandLabel = isAllExpanded ? "Згорнути все" : "Розгорнути все";

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-3">
						<h1 className="text-2xl font-bold tracking-tight">
							Планувальник ІНП
						</h1>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="flex items-center gap-2 cursor-default">
									<CircularProgress
										value={percentage}
										size={28}
										strokeWidth={3}
									/>
									<span className="text-sm text-muted-foreground tabular-nums">
										{summary.totalCredits}/{BACHELOR_TOTAL_CREDITS}
									</span>
								</div>
							</TooltipTrigger>
							<TooltipContent>
								Заплановано {summary.totalCredits} з {BACHELOR_TOTAL_CREDITS}{" "}
								кредитів
							</TooltipContent>
						</Tooltip>
					</div>
					<p className="text-sm text-muted-foreground">{subtitle}</p>
				</div>

				<div className="flex items-center rounded-lg border bg-muted/30 p-1">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-8 px-2 rounded-md hover:bg-transparent text-muted-foreground hover:text-foreground"
								onClick={onToggleExpandAll}
								aria-label={expandLabel}
								aria-pressed={isAllExpanded}
							>
								{isAllExpanded ? (
									<ListCollapse className="size-4" />
								) : (
									<ListFilter className="size-4" />
								)}
							</Button>
						</TooltipTrigger>
						<TooltipContent>{expandLabel}</TooltipContent>
					</Tooltip>
				</div>
			</div>
			<CategoryLegend />
		</div>
	);
}
