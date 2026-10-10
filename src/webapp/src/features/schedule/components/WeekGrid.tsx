import { Fragment } from "react";

import { LessonCard } from "./LessonCard";
import { formatDayDate } from "../scheduleDates";
import {
	BELL_SLOTS,
	type MySchedule,
	type ScheduleCourse,
	WEEKDAYS,
} from "../scheduleTypes";

interface WeekGridProps {
	readonly schedule: MySchedule;
	readonly courses: ReadonlyMap<string, ScheduleCourse>;
}

/** Desktop week: days across, bell slots down, only the slots the week uses. */
export function WeekGrid({ schedule, courses }: Readonly<WeekGridProps>) {
	const slots = schedule.lessons.map((lesson) => lesson.slot);
	const first = Math.min(...slots);
	const last = Math.max(...slots);
	const rows = Array.from({ length: last - first + 1 }, (_, i) => first + i);

	return (
		<div className="grid grid-cols-[5.5rem_repeat(5,minmax(0,1fr))] gap-2 rounded-xl border bg-card p-4">
			<span />
			{WEEKDAYS.map((day, index) => (
				<div key={day} className="px-1 pb-1 text-sm font-semibold">
					{day}{" "}
					<span className="font-mono text-xs font-normal text-muted-foreground">
						{formatDayDate(schedule.week.starts_on, index)}
					</span>
				</div>
			))}
			{rows.map((slot) => (
				<Fragment key={slot}>
					<div className="pt-2 text-sm font-medium">
						{slot} пара
						<span className="block font-mono text-xs font-normal text-muted-foreground">
							{BELL_SLOTS[slot]}
						</span>
					</div>
					{WEEKDAYS.map((day, index) => {
						const lesson = schedule.lessons.find(
							(item) => item.slot === slot && item.day === index + 1,
						);
						const course = lesson ? courses.get(lesson.course_id) : undefined;
						return lesson && course ? (
							<LessonCard key={day} lesson={lesson} course={course} />
						) : (
							<div
								key={day}
								className="min-h-16 rounded-lg border border-dashed border-border/60"
							/>
						);
					})}
				</Fragment>
			))}
		</div>
	);
}
