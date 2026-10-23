import { Button } from "@/components/ui/Button";
import {
	formatDecimalValue,
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import type { CourseList } from "@/lib/api/generated";
import { getFacultyColors } from "@/lib/faculty-colors";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { useCourseLoad } from "../hooks/useCourseLoad";
import { courseKindFor } from "../planOffering";
import {
	formatPlanCredits,
	formatReviewsCount,
	PLAN_KIND_STYLES,
} from "../planFormatting";
import type { PlanCourse, PlanSlot, PlanTerm } from "../planTypes";

interface CatalogCourseRowProps {
	readonly course: CourseList;
	readonly term: PlanTerm;
	readonly specialityId: string | undefined;
	readonly onAdd: (course: PlanCourse, slot: PlanSlot) => void;
}

function Score({
	label,
	value,
	tone,
}: Readonly<{
	label: string;
	value: number | null | undefined;
	tone: string;
}>) {
	return (
		<span>
			<span className="text-xs text-muted-foreground">{label} </span>
			<strong className={tone}>{formatDecimalValue(value)}</strong>
		</span>
	);
}

export function CatalogCourseRow({
	course,
	term,
	specialityId,
	onAdd,
}: CatalogCourseRowProps) {
	const load = useCourseLoad(course.id ?? "", term);
	const kind = courseKindFor(course.specialities, specialityId);
	const facultyName = course.faculty_name ?? null;
	const hasRatings = (course.ratings_count ?? 0) > 0;

	const add = (slot: PlanSlot) =>
		onAdd(
			{
				courseId: course.id ?? "",
				title: course.title ?? "",
				kind,
				facultyName,
				credits: load.credits,
				weeklyHours: load.weeklyHours,
			},
			slot,
		);

	return (
		<div
			className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-2 py-2.5 last:border-b-0 sm:flex-nowrap"
			data-testid={testIds.personalPlan.catalogRow}
		>
			<span
				aria-hidden
				className={cn(
					"size-2 shrink-0 rounded-full bg-current",
					getFacultyColors(facultyName ?? "").text,
				)}
			/>
			<div className="flex min-w-0 grow basis-60 flex-col gap-0.5">
				<span className="text-sm font-medium">{course.title}</span>
				<span className="text-xs text-muted-foreground">
					{[
						facultyName,
						PLAN_KIND_STYLES[kind].label,
						formatReviewsCount(course.ratings_count ?? 0),
					]
						.filter(Boolean)
						.join(" · ")}
				</span>
			</div>
			<span className="flex shrink-0 items-center gap-3.5 text-sm">
				<Score
					label="Складність"
					value={hasRatings ? course.avg_difficulty : null}
					tone={getDifficultyTone(hasRatings ? course.avg_difficulty : null)}
				/>
				<Score
					label="Корисність"
					value={hasRatings ? course.avg_usefulness : null}
					tone={getUsefulnessTone(hasRatings ? course.avg_usefulness : null)}
				/>
				<span
					className={cn(
						"w-28 text-right font-semibold whitespace-nowrap tabular-nums",
						load.isLoading && "animate-pulse text-muted-foreground",
					)}
				>
					{formatPlanCredits(load.credits)} ECTS / {load.weeklyHours ?? "—"} год
				</span>
			</span>
			<span className="flex shrink-0 gap-1.5">
				<Button size="sm" disabled={load.isLoading} onClick={() => add("main")}>
					Додати
				</Button>
				<Button
					size="sm"
					variant="outline"
					disabled={load.isLoading}
					onClick={() => add("backup")}
				>
					Як запасну
				</Button>
			</span>
		</div>
	);
}
