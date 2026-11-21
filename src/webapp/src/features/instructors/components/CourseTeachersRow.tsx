import { testIds } from "@/lib/test-ids";
import type { CourseTeacher } from "../courseTeachers";

interface CourseTeachersRowProps {
	readonly teachers: ReadonlyArray<CourseTeacher>;
}

/** "Викладачі: …" under the course title; nothing when no teacher qualifies. */
export function CourseTeachersRow({ teachers }: CourseTeachersRowProps) {
	if (teachers.length === 0) return null;

	return (
		<section
			aria-labelledby="course-teachers-heading"
			className="flex max-w-4xl flex-wrap items-baseline gap-x-2 gap-y-1 text-sm"
			data-testid={testIds.courseDetails.teachers}
		>
			<h2
				id="course-teachers-heading"
				className="font-normal text-muted-foreground"
			>
				Викладачі:
			</h2>
			<ul className="flex flex-wrap gap-x-4 gap-y-1">
				{teachers.map((teacher) => (
					<li key={teacher.id}>
						<span className="font-medium">{teacher.name}</span>
						<span className="text-muted-foreground"> · {teacher.note}</span>
					</li>
				))}
			</ul>
		</section>
	);
}
