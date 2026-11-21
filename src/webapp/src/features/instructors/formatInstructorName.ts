export interface InstructorNameParts {
	readonly last_name?: string;
	readonly first_name?: string;
	readonly patronymic?: string;
}

export function formatInstructorName(instructor: InstructorNameParts): string {
	return [instructor.last_name, instructor.first_name, instructor.patronymic]
		.filter(Boolean)
		.join(" ");
}

export function formatInstructorShortName(
	instructor: InstructorNameParts,
): string {
	const initials = [instructor.first_name, instructor.patronymic]
		.flatMap((part) => (part ? [`${part.charAt(0)}.`] : []))
		.join(" ");
	return [instructor.last_name, initials].filter(Boolean).join(" ");
}
