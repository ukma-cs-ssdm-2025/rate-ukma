import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { formatPlanCredits, PLAN_KIND_STYLES } from "../planFormatting";
import { PLAN_LIMITS, type PlanSummary } from "../planRules";

type Tone = "muted" | "success" | "destructive";

const HINT_TONES: Record<Tone, string> = {
	muted: "text-muted-foreground",
	success: "text-success",
	destructive: "text-destructive",
};

interface StatProps {
	readonly label: string;
	readonly value: number;
	readonly limit: string;
	readonly max: number;
	readonly hint: string;
	readonly tone: Tone;
	/** Fill color of the bar while the rule holds. */
	readonly fill: string;
}

type StatValues = Omit<StatProps, "label" | "fill">;

function PlanStat({ label, value, limit, max, hint, tone, fill }: StatProps) {
	const share = max > 0 ? Math.min(value / max, 1) : 0;
	return (
		<div className="flex flex-col gap-2 px-5 py-4">
			<span className="text-sm text-muted-foreground">{label}</span>
			<span className="text-2xl font-semibold tabular-nums">
				{formatPlanCredits(value)}{" "}
				<span className="text-sm font-normal text-muted-foreground">
					{limit}
				</span>
			</span>
			<span
				aria-hidden
				className="block h-2 overflow-hidden rounded-full bg-muted"
			>
				<span
					className={cn(
						"block h-full rounded-full",
						tone === "destructive" ? "bg-destructive" : fill,
					)}
					style={{ width: `${share * 100}%` }}
				/>
			</span>
			<span className={cn("text-sm font-medium", HINT_TONES[tone])}>
				{hint}
			</span>
		</div>
	);
}

function totalStat(total: number): StatValues {
	const goal = PLAN_LIMITS.totalCredits;
	const left = goal - total;
	const base = { value: total, limit: `з ${goal}`, max: goal };
	if (left > 0) {
		return {
			...base,
			hint: `Ще ${formatPlanCredits(left)} до ${goal}`,
			tone: "muted",
		};
	}
	if (left === 0) return { ...base, hint: `Рівно ${goal}`, tone: "success" };
	return {
		...base,
		hint: `Понад ${goal} на ${formatPlanCredits(-left)}`,
		tone: "destructive",
	};
}

function profOrientedStat(credits: number): StatValues {
	const min = PLAN_LIMITS.minProfOrientedCredits;
	const done = credits >= min;
	return {
		value: credits,
		limit: `мін. ${min}`,
		max: min,
		hint: done
			? "Вимогу виконано"
			: `Ще щонайменше ${formatPlanCredits(min - credits)}`,
		tone: done ? "success" : "muted",
	};
}

function electiveStat(credits: number): StatValues {
	const max = PLAN_LIMITS.maxElectiveCredits;
	const over = credits > max;
	return {
		value: credits,
		limit: `макс. ${max}`,
		max,
		hint: over
			? `Перевищено на ${formatPlanCredits(credits - max)}`
			: `Можна ще ${formatPlanCredits(max - credits)}`,
		tone: over ? "destructive" : "muted",
	};
}

export function PlanCreditsSummary({
	summary,
}: Readonly<{ summary: PlanSummary }>) {
	return (
		<Card
			className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0"
			data-testid={testIds.personalPlan.progress}
		>
			<PlanStat
				label="Всього кредитів"
				fill="bg-primary"
				{...totalStat(summary.totalCredits)}
			/>
			<PlanStat
				label={PLAN_KIND_STYLES.PROF_ORIENTED.groupLabel}
				fill={PLAN_KIND_STYLES.PROF_ORIENTED.dot}
				{...profOrientedStat(summary.profOrientedCredits)}
			/>
			<PlanStat
				label={PLAN_KIND_STYLES.ELECTIVE.groupLabel}
				fill={PLAN_KIND_STYLES.ELECTIVE.dot}
				{...electiveStat(summary.electiveCredits)}
			/>
		</Card>
	);
}

export function PlanCreditsSummarySkeleton() {
	return <Skeleton className="h-32 rounded-xl" />;
}
