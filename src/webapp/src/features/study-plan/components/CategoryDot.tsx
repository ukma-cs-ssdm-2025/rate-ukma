import { CATEGORY_LABELS } from "@/features/study-plan/studyPlanRules";
import type { PlanCourseCategory } from "@/features/study-plan/studyPlanTypes";
import { cn } from "@/lib/utils";

const CATEGORY_DOT_CLASSES: Record<PlanCourseCategory, string> = {
	COMPULSORY: "bg-muted-foreground/40",
	PROF_ORIENTED: "bg-primary",
	ELECTIVE: "bg-usefulness",
};

export function getCategoryBarClass(category: PlanCourseCategory): string {
	return CATEGORY_DOT_CLASSES[category];
}

interface CategoryDotProps {
	category: PlanCourseCategory;
	className?: string;
}

export function CategoryDot({
	category,
	className,
}: Readonly<CategoryDotProps>) {
	return (
		<span
			className={cn(
				"inline-block size-2 rounded-full shrink-0",
				CATEGORY_DOT_CLASSES[category],
				className,
			)}
			title={CATEGORY_LABELS[category]}
			aria-label={CATEGORY_LABELS[category]}
			role="img"
		/>
	);
}

export function CategoryLegend() {
	const categories: PlanCourseCategory[] = [
		"COMPULSORY",
		"PROF_ORIENTED",
		"ELECTIVE",
	];
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
			{categories.map((category) => (
				<span key={category} className="flex items-center gap-1.5">
					<CategoryDot category={category} />
					{CATEGORY_LABELS[category]}
				</span>
			))}
		</div>
	);
}
