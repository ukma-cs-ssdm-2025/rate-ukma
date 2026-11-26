import type {
	UkmaDataReviewCase,
	UkmaDataReviewCaseKindEnum,
} from "@/lib/api/generated";
import { academicYear, candidateIds, formatDateTime } from "./reviewCases";
import { formatCount, pluralForm } from "./syncFormat";
import type { PluralForms } from "./syncFormat";

export interface CaseSide {
	label: string;
	title: string;
	rows: readonly (readonly [string, string])[];
}

export interface CaseOption {
	name: string;
	effect: string;
}

const countWord = (count: number, forms: PluralForms): string =>
	`${formatCount(count)} ${pluralForm(count, forms)}`;

const SIMILAR_STUDENTS = {
	one: "наявний студент",
	few: "наявні студенти",
	many: "наявних студентів",
} satisfies PluralForms;

const SIMILAR_COURSES = {
	one: "схожа дисципліна",
	few: "схожі дисципліни",
	many: "схожих дисциплін",
} satisfies PluralForms;

const SIMILAR_TEACHERS = {
	one: "схожий викладач",
	few: "схожі викладачі",
	many: "схожих викладачів",
} satisfies PluralForms;

const SEMESTERS = {
	one: "семестр",
	few: "семестри",
	many: "семестрів",
} satisfies PluralForms;

const NOW = "Зараз";
const STATE = "Стан";
const WHILE_OPEN = "Поки справа була відкрита";
const INTERIM_LABELS = new Set([NOW, STATE]);

export const DIFFERENT_PEOPLE =
	"Якщо це різні люди, залиште справу відкритою: UKMA Data запитає ще раз, коли з'являться нові дані.";

export function caseSides(
	reviewCase: UkmaDataReviewCase,
): readonly [CaseSide, CaseSide] {
	const [first, second] = openCaseSides(reviewCase);
	if (reviewCase.status === "open") {
		return [first, second];
	}
	return [pastSide(first), pastSide(second)];
}

const pastSide = (side: CaseSide): CaseSide => ({
	...side,
	rows: side.rows.map(([label, value]) =>
		INTERIM_LABELS.has(label) ? [WHILE_OPEN, value] : [label, value],
	),
});

function openCaseSides(
	reviewCase: UkmaDataReviewCase,
): readonly [CaseSide, CaseSide] {
	const count = candidateIds(reviewCase).length;
	const opened = formatDateTime(reviewCase.opened_at);
	switch (reviewCase.kind) {
		case "student_match":
			return [
				{
					label: "Запис із САЗ",
					title: "Запис про навчання студента",
					rows: [
						["Звідки", "Списки студентів САЗ"],
						["Отримано", opened],
					],
				},
				{
					label: "З ким зіставлено",
					title: countWord(count, SIMILAR_STUDENTS),
					rows: [[NOW, "Приєднано до найближчого збігу"]],
				},
			];
		case "removals_held": {
			const year = academicYear(reviewCase);
			return [
				{
					label: "На сайті",
					title: countWord(count, SEMESTERS),
					rows: [
						["Навчальний рік", year === null ? "—" : `${year}–${year + 1}`],
						[STATE, "Залишаються на сайті"],
					],
				},
				{
					label: "У САЗ",
					title: "Цих семестрів більше немає",
					rows: [["Помічено", opened]],
				},
			];
		}
		case "course_match":
			return [
				{
					label: "Запис із САЗ",
					title: "Семестр дисципліни",
					rows: [["Отримано", opened]],
				},
				{
					label: "З чим зіставлено",
					title: countWord(count, SIMILAR_COURSES),
					rows: [[NOW, "Окрема дисципліна"]],
				},
			];
		case "instructor_match":
			return [
				{
					label: "Запис із САЗ",
					title: "Викладач семестру",
					rows: [["Отримано", opened]],
				},
				{
					label: "З ким зіставлено",
					title: countWord(count, SIMILAR_TEACHERS),
					rows: [[NOW, "Семестр без цього викладача"]],
				},
			];
	}
}

const OPTIONS = {
	student_match: [
		{
			name: "Та сама людина",
			effect: "запис лишається за цим студентом, справу закрито.",
		},
	],
	removals_held: [
		{ name: "Прибрати", effect: "семестри зникнуть із сайту." },
		{ name: "Залишити", effect: "семестри лишаються, справу закрито." },
	],
	course_match: [
		{
			name: "Обʼєднати",
			effect: "семестр з'явиться на сторінці вибраної дисципліни.",
		},
		{
			name: "Не обʼєднувати",
			effect: "семестр лишається окремою дисципліною.",
		},
	],
	instructor_match: [
		{ name: "Той самий викладач", effect: "його покажуть на семестрі." },
		{ name: "Інша людина", effect: "семестр лишиться без цього зв'язку." },
	],
} satisfies Record<UkmaDataReviewCaseKindEnum, readonly CaseOption[]>;

const MEANWHILE = {
	student_match: "запис приєднано до найближчого наявного студента.",
	removals_held: "нічого не прибрано, семестри лишаються на сайті.",
	course_match: "семестр показано як окрему дисципліну.",
	instructor_match: "семестр показано без цього викладача.",
} satisfies Record<UkmaDataReviewCaseKindEnum, string>;

export const caseOptions = (
	kind: UkmaDataReviewCaseKindEnum,
): readonly CaseOption[] => OPTIONS[kind];

export function caseMeanwhile(reviewCase: UkmaDataReviewCase): string {
	switch (reviewCase.status) {
		case "open":
			return `Поки рішення немає, ${MEANWHILE[reviewCase.kind]}`;
		case "decided":
			return "Справу вирішено в UKMA Data. Вище те, що показували, поки вона була відкрита.";
		case "obsolete":
			return "Справа більше не актуальна: дані в САЗ змінились, і питання зникло.";
	}
}

export function stepIndex(
	ids: readonly string[],
	id: string,
	step: 1 | -1,
): string | null {
	const index = ids.indexOf(id);
	if (index === -1) {
		return null;
	}
	return ids[index + step] ?? null;
}
