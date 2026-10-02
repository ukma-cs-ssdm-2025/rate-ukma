interface InstructorNameParts {
	readonly last_name?: string;
	readonly first_name?: string;
	readonly patronymic?: string;
}

/** "Прізвище Ім'я По-батькові", skipping whatever the directory is missing. */
export function formatInstructorName(instructor: InstructorNameParts): string {
	return [instructor.last_name, instructor.first_name, instructor.patronymic]
		.filter(Boolean)
		.join(" ");
}

/** "Прізвище І. П." for tight spots; the full name stays in labels and chips. */
export function formatInstructorShortName(
	instructor: InstructorNameParts,
): string {
	const initials = [instructor.first_name, instructor.patronymic]
		.filter((part): part is string => Boolean(part))
		.map((part) => `${part.charAt(0)}.`)
		.join(" ");
	return [instructor.last_name, initials].filter(Boolean).join(" ");
}
