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
