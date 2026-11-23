import axios from "axios";
import * as z from "zod";

import type { SyncJournalEntry, UkmaDataReviewCase } from "@/lib/api/generated";

const FALLBACK = "Не вдалося виконати дію. Спробуйте ще.";

const errorBody = z.object({ detail: z.string().min(1) });

export const DECIDE_LABEL = "Це та сама людина";

export function caseActionError(error: unknown): string {
	if (axios.isAxiosError(error)) {
		const body = errorBody.safeParse(error.response?.data);
		if (body.success) {
			return body.data.detail;
		}
	}
	return FALLBACK;
}

interface Confirm {
	title: string;
	description: string;
}

export const mergeLabel = (into: string): string => `Об'єднати з ${into}`;

export function decideConfirm(reviewCase: UkmaDataReviewCase): Confirm {
	return {
		title: "Це та сама людина?",
		description: `Справу ${reviewCase.id} буде закрито: запис і студент вважатимуться однією людиною. Це змінює спільні дані САЗ.`,
	};
}

export function mergeConfirm(
	reviewCase: UkmaDataReviewCase,
	into: string,
): Confirm {
	return {
		title: `Об'єднати дисципліну ${reviewCase.subject_id} з ${into}?`,
		description: `Семестр ${reviewCase.subject_id} приєднається до дисципліни ${into}. Це змінює спільні дані САЗ.`,
	};
}

export function unmergeCourseId(entry: SyncJournalEntry): string | null {
	if (
		entry.kind !== "decision" ||
		entry.counts.action !== "merge_course" ||
		entry.outcome !== "done"
	) {
		return null;
	}
	return entry.counts.target_id ?? null;
}

export function unmergeConfirm(targetId: string): Confirm {
	return {
		title: `Роз'єднати курс ${targetId}?`,
		description: `Курс ${targetId} знову стане окремим. Це змінює спільні дані САЗ.`,
	};
}
