import { formatInstructorShortName } from "@/features/instructors/formatInstructorName";
import type { CourseOffering } from "@/lib/api/generated";

export function yearTeachers(records: readonly CourseOffering[]): string[] {
	const names = new Map<string, string>();
	for (const instructor of records.flatMap((record) => record.instructors)) {
		const name = formatInstructorShortName({
			...instructor,
			patronymic: instructor.patronymic ?? undefined,
		});
		if (name) {
			names.set(instructor.id, name);
		}
	}
	return [...names.values()];
}
