import { Lock } from "lucide-react";

import {
	formatDecimalValue,
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { useCoursesRetrieve } from "@/lib/api/generated";
import { getFacultyHexColor } from "@/lib/faculty-colors";
import { cn } from "@/lib/utils";
import type { QueueItem, Scores } from "./useRateQueue";

function ratingsWord(count: number): string {
	const mod10 = count % 10;
	const mod100 = count % 100;
	if (mod10 === 1 && mod100 !== 11) return "оцінка";
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
		return "оцінки";
	return "оцінок";
}

export function FacultyDot({ name }: Readonly<{ name: string }>) {
	return (
		<span
			aria-hidden="true"
			className="inline-block size-2 shrink-0 rounded-full"
			style={{ backgroundColor: getFacultyHexColor(name) }}
		/>
	);
}

function Delta({ mine, theirs }: Readonly<{ mine?: number; theirs: number }>) {
	if (mine == null) return null;
	const diff = mine - theirs;
	if (Math.abs(diff) < 0.5) {
		return <span className="text-xs text-muted-foreground">як у всіх</span>;
	}
	return (
		<span className="text-xs text-muted-foreground">
			у тебе {diff > 0 ? "вище" : "нижче"}
		</span>
	);
}

/**
 * What other students gave the course. `hidden` keeps the numbers back until
 * the student has picked their own scores, so the average cannot anchor them.
 */
export function OthersScores({
	item,
	mine,
	hidden = false,
	compact = false,
}: Readonly<{
	item: QueueItem;
	mine?: Partial<Scores>;
	hidden?: boolean;
	compact?: boolean;
}>) {
	const { data: course } = useCoursesRetrieve(item.courseId);
	const count = course?.ratings_count ?? 0;
	const difficulty = course?.avg_difficulty ?? null;
	const usefulness = course?.avg_usefulness ?? null;

	if (count === 0 && course) {
		return (
			<p className="text-sm text-muted-foreground">
				Ще ніхто не оцінив. Твоя оцінка буде першою.
			</p>
		);
	}

	return (
		<div className={cn("space-y-2", compact && "space-y-1")}>
			<div className="flex items-baseline justify-between gap-3">
				<p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
					Інші студенти
				</p>
				{course ? (
					<p className="text-xs text-muted-foreground tabular-nums">
						{count} {ratingsWord(count)}
					</p>
				) : null}
			</div>
			{hidden ? (
				<p className="flex items-center gap-2 text-sm text-muted-foreground">
					<Lock className="size-4" aria-hidden="true" />
					Відкриється, коли поставиш свою оцінку
				</p>
			) : (
				<dl className="grid grid-cols-2 gap-3">
					<div className="rounded-lg bg-muted/60 px-3 py-2">
						<dt className="text-xs text-muted-foreground">Складність</dt>
						<dd className="flex items-baseline gap-2">
							<span
								className={cn(
									"text-xl font-semibold tabular-nums",
									getDifficultyTone(difficulty),
								)}
							>
								{formatDecimalValue(difficulty)}
							</span>
							{difficulty != null ? (
								<Delta mine={mine?.difficulty} theirs={difficulty} />
							) : null}
						</dd>
					</div>
					<div className="rounded-lg bg-muted/60 px-3 py-2">
						<dt className="text-xs text-muted-foreground">Корисність</dt>
						<dd className="flex items-baseline gap-2">
							<span
								className={cn(
									"text-xl font-semibold tabular-nums",
									getUsefulnessTone(usefulness),
								)}
							>
								{formatDecimalValue(usefulness)}
							</span>
							{usefulness != null ? (
								<Delta mine={mine?.usefulness} theirs={usefulness} />
							) : null}
						</dd>
					</div>
				</dl>
			)}
		</div>
	);
}

export function useCourseAverages(courseId: string) {
	const { data } = useCoursesRetrieve(courseId);
	return {
		difficulty: data?.avg_difficulty ?? null,
		usefulness: data?.avg_usefulness ?? null,
		description: data?.description ?? null,
	};
}

export function ProgressBar({
	done,
	total,
}: Readonly<{ done: number; total: number }>) {
	const share = total ? done / total : 0;
	return (
		<span
			className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={total}
			aria-valuenow={done}
		>
			<span
				className="block h-full origin-left rounded-full bg-primary transition-transform duration-500 motion-reduce:transition-none"
				style={{ transform: `scaleX(${share})` }}
			/>
		</span>
	);
}
