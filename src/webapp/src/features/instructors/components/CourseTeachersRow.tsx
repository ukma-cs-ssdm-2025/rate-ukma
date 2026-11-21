import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { testIds } from "@/lib/test-ids";
import type { CourseTeacher } from "../courseTeachers";

interface CourseTeachersRowProps {
	readonly teachers: ReadonlyArray<CourseTeacher>;
}

/** "Викладачі: …" under the course title, names only; why a teacher is
 *  listed shows on hover and is read out by screen readers. Nothing when no
 *  teacher qualifies. */
export function CourseTeachersRow({ teachers }: CourseTeachersRowProps) {
	if (teachers.length === 0) {
		return null;
	}

	return (
		<section
			aria-labelledby="course-teachers-heading"
			className="flex max-w-4xl flex-wrap items-baseline gap-x-1 text-sm"
			data-testid={testIds.courseDetails.teachers}
		>
			<h2
				id="course-teachers-heading"
				className="font-normal text-muted-foreground"
			>
				Викладачі:
			</h2>
			<ul className="contents">
				{teachers.map((teacher, index) => (
					<li key={teacher.id}>
						<CourseTeacherName teacher={teacher} />
						{index < teachers.length - 1 ? "," : null}
					</li>
				))}
			</ul>
		</section>
	);
}

function CourseTeacherName({ teacher }: Readonly<{ teacher: CourseTeacher }>) {
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<button
					type="button"
					className="cursor-help rounded-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				>
					{teacher.name}
					<span className="sr-only">, {teacher.note}</span>
				</button>
			</TooltipTrigger>
			<TooltipContent>{teacher.note}</TooltipContent>
		</Tooltip>
	);
}
