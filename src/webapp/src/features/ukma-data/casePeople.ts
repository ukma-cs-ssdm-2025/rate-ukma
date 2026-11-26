import type {
	UkmaDataCasePerson,
	UkmaDataPersonStatusEnum,
	UkmaDataSiteOffering,
	UkmaDataStudentCase,
} from "@/lib/api/generated";
import { countWith, RATINGS } from "./syncFormat";
import { termWord } from "./syncLabels";

const PERSON_STATUS = {
	active: "навчається",
	inactive: "не навчається",
} satisfies Record<UkmaDataPersonStatusEnum, string>;

export interface PersonColumn {
	key: string;
	label: string;
	record: boolean;
	values: readonly string[];
	differs: readonly boolean[];
}

export interface PeopleTable {
	rows: readonly string[];
	columns: readonly PersonColumn[];
}

export const PERSON_ROWS = ["ПІБ", "Програма", "Рік навчання", "Стан"];

const EMPTY = "—";

export function fullName(person: UkmaDataCasePerson): string {
	return [person.last_name, person.first_name, person.middle_name ?? ""]
		.filter((part) => part !== "")
		.join(" ");
}

export function initials(person: UkmaDataCasePerson): string {
	const given = [person.first_name, person.middle_name ?? ""]
		.flatMap((part) => (part === "" ? [] : [`${part.charAt(0)}.`]))
		.join(" ");
	return [person.last_name, given].filter((part) => part !== "").join(" ");
}

function personValues(person: UkmaDataCasePerson): string[] {
	return [
		fullName(person) || EMPTY,
		person.programme ?? EMPTY,
		person.study_year === null ? EMPTY : `${person.study_year}-й`,
		person.status === null ? EMPTY : PERSON_STATUS[person.status],
	];
}

export function peopleTable(found: UkmaDataStudentCase): PeopleTable {
	const record = personValues(found.record);
	const columns: PersonColumn[] = [
		{
			key: found.record.student_id,
			label: "Новий запис із САЗ",
			record: true,
			values: record,
			differs: record.map(() => false),
		},
		...found.candidates.map((candidate) => {
			const values = personValues(candidate);
			const joined = candidate.student_id === found.joined_student_id;
			return {
				key: candidate.student_id,
				label: joined ? "Приєднано зараз" : "Схожий студент",
				record: false,
				values,
				differs: values.map((value, index) => value !== record[index]),
			};
		}),
	];
	return { rows: PERSON_ROWS, columns };
}

export function caseRowHint(found: UkmaDataStudentCase): string {
	const { record } = found;
	return [
		initials(record),
		record.programme,
		record.study_year === null ? null : `${record.study_year}-й рік`,
	]
		.filter((part) => part !== null && part !== "")
		.join(", ");
}

export function offeringSemester(offering: UkmaDataSiteOffering): string {
	const term = termWord(offering.term);
	return term === null ? `${offering.year}` : `${term} ${offering.year}`;
}

export function offeringFacts(offering: UkmaDataSiteOffering): string {
	return [
		offering.department,
		offeringSemester(offering),
		offering.ratings > 0 ? countWith(offering.ratings, RATINGS) : "без оцінок",
	]
		.filter((part) => part !== null && part !== "")
		.join(", ");
}
