import type { ReactNode } from "react";

import {
	BACHELOR_TOTAL_CREDITS,
	CATEGORY_LABELS,
	creditsToHours,
	ELECTIVE_MAX_CREDITS,
	formatCredits,
	formatHours,
	type PlanSummary,
	PROF_ORIENTED_MIN_CREDITS,
} from "@/features/study-plan/studyPlanRules";
import type { PlanCourseCategory } from "@/features/study-plan/studyPlanTypes";
import { cn } from "@/lib/utils";
import { CategoryDot, getCategoryBarClass } from "./CategoryDot";

interface StudyPlanSummaryProps {
	summary: PlanSummary;
}

const STACK_ORDER: PlanCourseCategory[] = [
	"COMPULSORY",
	"PROF_ORIENTED",
	"ELECTIVE",
];

function toPercent(value: number, total: number): number {
	if (total === 0) return 0;
	return Math.min(100, (value / total) * 100);
}

export function StudyPlanSummary({ summary }: Readonly<StudyPlanSummaryProps>) {
	const { categories } = summary;

	return (
		<section
			aria-labelledby="study-plan-summary-title"
			className="rounded-xl border bg-card p-5 sm:p-6 space-y-6"
		>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div className="space-y-1">
					<h2
						id="study-plan-summary-title"
						className="text-sm font-medium text-muted-foreground"
					>
						Усього за весь термін навчання
					</h2>
					<p className="text-3xl font-semibold tabular-nums tracking-tight">
						{summary.totalCredits}
						<span className="text-lg font-normal text-muted-foreground">
							{" "}
							/ {BACHELOR_TOTAL_CREDITS} кредитів
						</span>
					</p>
					<p className="text-sm text-muted-foreground tabular-nums">
						{formatHours(creditsToHours(summary.totalCredits))} з{" "}
						{formatHours(creditsToHours(BACHELOR_TOTAL_CREDITS))}
					</p>
				</div>
				<RemainingTotal summary={summary} />
			</div>

			<div
				className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
				role="img"
				aria-label={`${summary.totalCredits} з ${BACHELOR_TOTAL_CREDITS} кредитів`}
			>
				{STACK_ORDER.map((category) => (
					<div
						key={category}
						className={cn("h-full", getCategoryBarClass(category))}
						style={{
							width: `${toPercent(categories[category], BACHELOR_TOTAL_CREDITS)}%`,
						}}
					/>
				))}
			</div>

			<div className="grid gap-4 sm:grid-cols-3">
				<CategoryStat
					category="COMPULSORY"
					credits={categories.COMPULSORY}
					limitLabel="визначені програмою"
				/>
				<CategoryStat
					category="PROF_ORIENTED"
					credits={categories.PROF_ORIENTED}
					limitLabel={`не менше ${PROF_ORIENTED_MIN_CREDITS}`}
					progress={toPercent(
						categories.PROF_ORIENTED,
						PROF_ORIENTED_MIN_CREDITS,
					)}
					hint={<ProfOrientedHint missing={summary.profOrientedMissing} />}
				/>
				<CategoryStat
					category="ELECTIVE"
					credits={categories.ELECTIVE}
					limitLabel={`не більше ${ELECTIVE_MAX_CREDITS}`}
					progress={toPercent(categories.ELECTIVE, ELECTIVE_MAX_CREDITS)}
					isOverLimit={summary.electiveExcess > 0}
					hint={
						<ElectiveHint
							available={summary.electiveAvailable}
							excess={summary.electiveExcess}
						/>
					}
				/>
			</div>
		</section>
	);
}

function RemainingTotal({ summary }: Readonly<{ summary: PlanSummary }>) {
	if (summary.excessCredits > 0) {
		return (
			<p className="text-sm text-destructive">
				Перевищено на {formatCredits(summary.excessCredits)} — має бути рівно{" "}
				{BACHELOR_TOTAL_CREDITS}
			</p>
		);
	}
	if (summary.remainingCredits === 0) {
		return (
			<p className="text-sm text-muted-foreground">Усі кредити заплановано</p>
		);
	}
	return (
		<div className="text-right">
			<p className="text-sm text-muted-foreground">Залишилось добрати</p>
			<p className="text-xl font-semibold tabular-nums">
				{formatCredits(summary.remainingCredits)}
			</p>
		</div>
	);
}

interface CategoryStatProps {
	category: PlanCourseCategory;
	credits: number;
	limitLabel: string;
	progress?: number;
	isOverLimit?: boolean;
	hint?: ReactNode;
}

function CategoryStat({
	category,
	credits,
	limitLabel,
	progress,
	isOverLimit = false,
	hint,
}: Readonly<CategoryStatProps>) {
	return (
		<div className="space-y-2 rounded-lg bg-muted/40 p-3">
			<div className="flex items-center gap-2 text-sm text-muted-foreground">
				<CategoryDot category={category} />
				{CATEGORY_LABELS[category]}
			</div>
			<p className="tabular-nums">
				<span className="text-lg font-semibold">{credits}</span>
				<span className="text-sm text-muted-foreground">
					{" "}
					кр. · {limitLabel}
				</span>
			</p>
			{progress != null && (
				<div className="h-1 w-full overflow-hidden rounded-full bg-muted">
					<div
						className={cn(
							"h-full rounded-full",
							isOverLimit ? "bg-destructive" : getCategoryBarClass(category),
						)}
						style={{ width: `${progress}%` }}
					/>
				</div>
			)}
			{hint && <div className="text-xs">{hint}</div>}
		</div>
	);
}

function ProfOrientedHint({ missing }: Readonly<{ missing: number }>) {
	if (missing === 0) {
		return <span className="text-muted-foreground">Мінімум виконано</span>;
	}
	return (
		<span className="text-difficulty-foreground dark:text-difficulty">
			Потрібно ще {formatCredits(missing)}
		</span>
	);
}

function ElectiveHint({
	available,
	excess,
}: Readonly<{ available: number; excess: number }>) {
	if (excess > 0) {
		return (
			<span className="text-destructive">
				Ліміт перевищено на {formatCredits(excess)}
			</span>
		);
	}
	return (
		<span className="text-muted-foreground">
			Можна додати ще {formatCredits(available)}
		</span>
	);
}
