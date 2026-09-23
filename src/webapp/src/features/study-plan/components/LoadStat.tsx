import {
	creditsToHours,
	formatCredits,
	formatHours,
} from "@/features/study-plan/studyPlanRules";
import { cn } from "@/lib/utils";

interface LoadStatProps {
	credits: number;
	className?: string;
}

/** "30 кр. · 900 год" — the single way credits and hours are shown together. */
export function LoadStat({ credits, className }: Readonly<LoadStatProps>) {
	return (
		<span className={cn("tabular-nums whitespace-nowrap", className)}>
			<span className="font-medium text-foreground">
				{formatCredits(credits)}
			</span>
			<span className="text-muted-foreground">
				{" · "}
				{formatHours(creditsToHours(credits))}
			</span>
		</span>
	);
}
