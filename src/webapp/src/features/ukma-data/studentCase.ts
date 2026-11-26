import type {
	UkmaDataCasePerson,
	UkmaDataCasePerson1,
	UkmaDataStudentCase,
	UkmaDataStudentStatusEnum,
} from "@/lib/api/generated";

type CasePerson = UkmaDataCasePerson | UkmaDataCasePerson1;

type StudentField =
	| "first_name"
	| "middle_name"
	| "last_name"
	| "programme"
	| "study_year"
	| "status";

export interface StudentColumn {
	key: string;
	heading: string;
}

export interface StudentRow {
	field: StudentField;
	label: string;
	values: readonly string[];
	differs: readonly boolean[];
}

export interface StudentComparison {
	columns: readonly StudentColumn[];
	rows: readonly StudentRow[];
	summary: string;
}

const MISSING = "—";

const FIELDS: readonly (readonly [StudentField, string])[] = [
	["last_name", "Прізвище"],
	["first_name", "Імʼя"],
	["middle_name", "По батькові"],
	["programme", "Програма"],
	["study_year", "Рік навчання"],
	["status", "Статус"],
];

const STATUS_WORDS = {
	active: "Навчається",
	inactive: "Не навчається",
} satisfies Record<UkmaDataStudentStatusEnum, string>;

function fieldValue(person: CasePerson, field: StudentField): string {
	switch (field) {
		case "first_name":
			return person.first_name || MISSING;
		case "middle_name":
			return person.middle_name || MISSING;
		case "last_name":
			return person.last_name || MISSING;
		case "programme":
			return person.programme ?? MISSING;
		case "study_year":
			return person.study_year === null ? MISSING : `${person.study_year}`;
		case "status":
			return person.status === null ? MISSING : STATUS_WORDS[person.status];
	}
}

const normalized = (value: string): string =>
	value
		.trim()
		.toLowerCase()
		.replaceAll(/[`’ʼ]/g, "'")
		.replaceAll(/\s+/g, " ");

const differsFrom = (record: string, other: string): boolean =>
	record !== MISSING &&
	other !== MISSING &&
	normalized(record) !== normalized(other);

function orderedCandidates(found: UkmaDataStudentCase): CasePerson[] {
	return [...found.candidates].sort(
		(left, right) =>
			Number(right.student_id === found.joined_student_id) -
			Number(left.student_id === found.joined_student_id),
	);
}

function heading(found: UkmaDataStudentCase, person: CasePerson): string {
	if (found.joined_student_id === null) {
		return "Схожий студент";
	}
	return person.student_id === found.joined_student_id
		? "Приєднано до студента"
		: "Ще схожий студент";
}

function summaryText(rows: readonly StudentRow[], joined: boolean): string {
	if (rows.every((row) => row.values.length < 2)) {
		return "У САЗ немає схожих студентів для порівняння.";
	}
	const differ = rows.flatMap((row) =>
		row.differs[1] ? [row.label.toLowerCase()] : [],
	);
	const against = joined
		? "зі студентом, до якого запис приєднано"
		: "зі студентом";
	if (differ.length === 0) {
		return `Усе, що знає САЗ, збігається ${against}.`;
	}
	return `Відрізняється від запису: ${differ.join(", ")}.`;
}

export function studentComparison(
	found: UkmaDataStudentCase,
): StudentComparison {
	const people = [found.record, ...orderedCandidates(found)];
	const columns = people.map((person, index) => ({
		key: `${index}-${person.student_id}`,
		heading: index === 0 ? "Новий запис із САЗ" : heading(found, person),
	}));
	const rows = FIELDS.map(([field, label]) => {
		const values = people.map((person) => fieldValue(person, field));
		return {
			field,
			label,
			values,
			differs: values.map(
				(value, index) => index > 0 && differsFrom(values[0] ?? MISSING, value),
			),
		};
	});
	return {
		columns,
		rows,
		summary: summaryText(rows, found.joined_student_id !== null),
	};
}
