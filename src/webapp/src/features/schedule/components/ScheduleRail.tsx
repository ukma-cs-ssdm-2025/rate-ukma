import { Link } from "@tanstack/react-router";
import { CalendarCheck, Star } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	getDifficultyTone,
	getUsefulnessTone,
} from "@/features/courses/courseFormatting";
import { cn } from "@/lib/utils";
import type { ScheduleCourse } from "../scheduleTypes";

function coursesWord(count: number): string {
	const tens = count % 100;
	const ones = count % 10;
	if (tens >= 11 && tens <= 14) return "курсів";
	if (ones === 1) return "курс";
	if (ones >= 2 && ones <= 4) return "курси";
	return "курсів";
}

/** One line for a semester that still has courses to rate; nothing otherwise. */
export function RateNudge({ count }: Readonly<{ count: number }>) {
	if (count === 0) return null;
	return (
		<div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
			<Star className="size-5 shrink-0 text-primary" aria-hidden />
			<p className="flex-1 text-sm">
				Ще не оцінено {count} {coursesWord(count)}
			</p>
			<Button asChild size="sm">
				<Link to="/my-ratings">Оцінити</Link>
			</Button>
		</div>
	);
}

function Score({
	label,
	value,
	tone,
}: Readonly<{ label: string; value: number | null; tone: string }>) {
	return (
		<span className="whitespace-nowrap text-xs text-muted-foreground">
			{label}{" "}
			<span className={cn("font-semibold tabular-nums", tone)}>
				{value ? value.toFixed(1) : "–"}
			</span>
		</span>
	);
}

/** The semester's courses with their Rate UKMA scores; each row opens the course page. */
export function ScheduleCourseList({
	courses,
	calendarConnected,
}: Readonly<{
	courses: ReadonlyArray<ScheduleCourse>;
	calendarConnected: boolean;
}>) {
	return (
		<section className="rounded-xl border bg-card p-4">
			<h2 className="mb-1 text-sm font-semibold">Курси семестру</h2>
			<ul>
				{courses.map((course) => (
					<li key={course.id} className="border-b last:border-b-0">
						<Link
							to="/courses/$courseId"
							params={{ courseId: course.id }}
							className="-mx-2 block rounded-md px-2 py-2.5 transition-colors hover:bg-accent"
						>
							<span className="block text-sm font-medium leading-snug">
								{course.title}
							</span>
							<span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
								<span className="text-xs text-muted-foreground">
									{course.group ? `Група ${course.group}` : "Лише лекції"}
								</span>
								<Score
									label="Складність"
									value={course.avg_difficulty}
									tone={getDifficultyTone(course.avg_difficulty)}
								/>
								<Score
									label="Корисність"
									value={course.avg_usefulness}
									tone={getUsefulnessTone(course.avg_usefulness)}
								/>
							</span>
						</Link>
					</li>
				))}
			</ul>
			{calendarConnected ? (
				<p className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
					<CalendarCheck className="size-4 text-primary" aria-hidden />
					Календар підключено
				</p>
			) : null}
		</section>
	);
}
