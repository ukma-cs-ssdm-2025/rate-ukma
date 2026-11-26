import type { UkmaDataRecord, UkmaDataReviewCase } from "@/lib/api/generated";
import { academicYear, candidateIds } from "./reviewCases";
import { countWith, formatCount } from "./syncFormat";
import type { PluralForms } from "./syncFormat";

export const MAX_RECORDS = 200;

const SEMESTERS = {
	one: "семестр",
	few: "семестри",
	many: "семестрів",
} satisfies PluralForms;

export interface RecordsSummary {
	heading: string;
	lines: readonly string[];
	subject: UkmaDataRecord | null;
	others: readonly UkmaDataRecord[];
	othersLabel: string | null;
}

export function caseRecordIds(reviewCase: UkmaDataReviewCase): string[] {
	switch (reviewCase.kind) {
		case "course_match":
			return [reviewCase.subject_id, ...candidateIds(reviewCase)].slice(
				0,
				MAX_RECORDS,
			);
		case "removals_held":
			return candidateIds(reviewCase).slice(0, MAX_RECORDS);
		default:
			return [];
	}
}

function cutLine(reviewCase: UkmaDataReviewCase): string[] {
	const total = candidateIds(reviewCase).length;
	return total > MAX_RECORDS
		? [`Показано перші ${formatCount(MAX_RECORDS)} з ${formatCount(total)}.`]
		: [];
}

function removalsSummary(
	reviewCase: UkmaDataReviewCase,
	records: readonly UkmaDataRecord[],
): RecordsSummary {
	const total = candidateIds(reviewCase).length;
	const year = academicYear(reviewCase);
	const rated = records.filter((record) => record.ratings > 0).length;
	const head = `${countWith(total, SEMESTERS)}${year === null ? "" : ` навчального року ${year}–${year + 1}`}`;
	const ratedText =
		rated === 0
			? "на жодному немає оцінок"
			: `на ${formatCount(rated)} з них є оцінки`;
	return {
		heading: "Які семестри зникли з САЗ",
		lines: [
			`${head}, ${ratedText}.`,
			"Поки справа відкрита, вони лишаються на сайті.",
			...cutLine(reviewCase),
		],
		subject: null,
		others: records,
		othersLabel: null,
	};
}

function courseSummary(records: readonly UkmaDataRecord[]): RecordsSummary {
	const [subject, ...others] = records;
	return {
		heading: "Це та сама дисципліна?",
		lines: ["Поки рішення немає, САЗ показує її окремою дисципліною."],
		subject: subject ?? null,
		others,
		othersLabel: others.length > 0 ? "Схожі дисципліни" : null,
	};
}

export function recordsSummary(
	reviewCase: UkmaDataReviewCase,
	records: readonly UkmaDataRecord[],
): RecordsSummary {
	return reviewCase.kind === "removals_held"
		? removalsSummary(reviewCase, records)
		: courseSummary(records);
}

export function recordTitle(
	records: readonly UkmaDataRecord[] | undefined,
	id: string,
): string {
	const title = records?.find((record) => record.id === id)?.title;
	return title ? `«${title}»` : id;
}
