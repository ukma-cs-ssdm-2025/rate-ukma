import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";
import type { ScheduleCourse, ScheduleLesson } from "../scheduleTypes";

interface LessonCardProps {
	readonly lesson: ScheduleLesson;
	readonly course: ScheduleCourse;
	readonly className?: string;
}

/** A lecture is a tinted card with a primary rule; the student's own group is solid primary. */
export function LessonCard({
	lesson,
	course,
	className,
}: Readonly<LessonCardProps>) {
	const isGroup = lesson.kind === "group";
	const meta = isGroup
		? `гр. ${course.group}, ${lesson.room}`
		: `лекція, ${lesson.room}`;

	return (
		<Link
			to="/courses/$courseId"
			params={{ courseId: course.id }}
			className={cn(
				"flex min-h-16 flex-col justify-center gap-0.5 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				isGroup
					? "bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary/90"
					: "border-l-[3px] border-primary bg-primary/10 hover:bg-primary/15",
				className,
			)}
		>
			<span className="line-clamp-2 text-sm font-semibold leading-snug">
				{course.title}
			</span>
			<span
				className={cn(
					"text-xs",
					isGroup ? "text-primary-foreground/80" : "text-muted-foreground",
				)}
			>
				{meta}
			</span>
		</Link>
	);
}
