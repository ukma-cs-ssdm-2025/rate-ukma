import { LessonCard } from "./LessonCard";
import { formatLongDay } from "../scheduleDates";
import {
	BELL_SLOTS,
	type MySchedule,
	type ScheduleCourse,
	WEEKDAYS,
} from "../scheduleTypes";

interface ScheduleAgendaProps {
	readonly schedule: MySchedule;
	readonly courses: ReadonlyMap<string, ScheduleCourse>;
}

/** Phone week: one section per day that has lessons, the time beside each card. */
export function ScheduleAgenda({
	schedule,
	courses,
}: Readonly<ScheduleAgendaProps>) {
	return (
		<div className="space-y-5">
			{WEEKDAYS.map((day, index) => {
				const lessons = schedule.lessons
					.filter((lesson) => lesson.day === index + 1)
					.sort((a, b) => a.slot - b.slot);
				if (lessons.length === 0) return null;
				return (
					<section key={day} aria-label={day} className="space-y-2">
						<h2 className="text-sm font-semibold">
							{day},{" "}
							<span className="font-normal text-muted-foreground">
								{formatLongDay(schedule.week.starts_on, index)}
							</span>
						</h2>
						{lessons.map((lesson) => {
							const course = courses.get(lesson.course_id);
							if (!course) return null;
							return (
								<div
									key={`${lesson.slot}-${lesson.course_id}`}
									className="grid grid-cols-[3.5rem_1fr] items-center gap-3"
								>
									<span className="font-mono text-xs text-muted-foreground">
										{BELL_SLOTS[lesson.slot].split("–")[0]}
									</span>
									<LessonCard lesson={lesson} course={course} />
								</div>
							);
						})}
					</section>
				);
			})}
		</div>
	);
}
