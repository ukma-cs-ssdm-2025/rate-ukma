import { countWith, formatCount, pluralForm } from "./syncFormat";
import type { PluralForms } from "./syncFormat";

export const DISCIPLINES = {
	one: "дисципліна",
	few: "дисципліни",
	many: "дисциплін",
} satisfies PluralForms;

export const NEW_DISCIPLINES = {
	one: "нова дисципліна",
	few: "нові дисципліни",
	many: "нових дисциплін",
} satisfies PluralForms;

export const SEMESTERS = {
	one: "семестр",
	few: "семестри",
	many: "семестрів",
} satisfies PluralForms;

export const NEW_SEMESTERS = {
	one: "новий семестр",
	few: "нові семестри",
	many: "нових семестрів",
} satisfies PluralForms;

export const ORGS = {
	one: "факультет чи кафедра",
	few: "факультети й кафедри",
	many: "факультетів і кафедр",
} satisfies PluralForms;

export const NEW_ORGS = {
	one: "новий факультет чи кафедра",
	few: "нові факультети й кафедри",
	many: "нових факультетів і кафедр",
} satisfies PluralForms;

export const PAIRS = {
	one: "пара",
	few: "пари",
	many: "пар",
} satisfies PluralForms;

export const RECORDS = {
	one: "запис",
	few: "записи",
	many: "записів",
} satisfies PluralForms;

export const RATINGS = {
	one: "оцінка",
	few: "оцінки",
	many: "оцінок",
} satisfies PluralForms;

export const cleanTitle = (title: string): string => title.replaceAll("`", "’");

export function semestersIn(count: number): string {
	return `${formatCount(count)} ${count % 10 === 1 && count % 100 !== 11 ? "семестрі" : "семестрах"}`;
}

export function ratingsText(count: number): string {
	return count > 0 ? countWith(count, RATINGS) : "без оцінок";
}

export function joinParts(parts: readonly string[]): string {
	if (parts.length <= 1) {
		return parts.join("");
	}
	return `${parts.slice(0, -1).join(", ")} і ${parts.at(-1) ?? ""}`;
}

export const word = (count: number, forms: PluralForms): string =>
	pluralForm(count, forms);

export const TERM_LABELS: ReadonlyMap<string, string> = new Map([
	["FALL", "Осінь"],
	["SPRING", "Весна"],
	["SUMMER", "Літо"],
]);

export const termLabel = (term: string): string =>
	TERM_LABELS.get(term) ?? term;

export function semesterLabel(year: number, term: string): string {
	return `${termLabel(term)} ${year}`;
}
