import axios from "axios";
import * as z from "zod";

import type { SyncJournalEntry, UkmaDataReviewCase } from "@/lib/api/generated";

const FALLBACK = "Не вдалося виконати дію. Спробуйте ще.";

const errorBody = z.object({ detail: z.string().min(1) });

export const DECIDE_LABEL = "Це та сама людина";

export const DECISION_FAILED_TEXT =
	"UKMA Data не відповіла, тож рішення могло й не записатися. Перевірте, перш ніж повторювати.";

export function caseActionError(error: unknown): string {
	if (axios.isAxiosError(error)) {
		const status = error.response?.status;
		if (status === undefined || status >= 500) {
			return DECISION_FAILED_TEXT;
		}
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
		title: `Об'єднати семестр ${reviewCase.subject_id} з дисципліною ${into}?`,
		description: `Семестр ${reviewCase.subject_id} приєднається до дисципліни ${into}. Це змінює спільні дані САЗ.`,
	};
}

export const unmergeCourseId = (entry: SyncJournalEntry): string | null =>
	doneTarget(entry, "merge_course");

const doneTarget = (
	entry: SyncJournalEntry,
	action: "merge_course" | "unmerge_course",
): string | null =>
	entry.kind === "decision" &&
	entry.counts.action === action &&
	entry.outcome === "done"
		? (entry.counts.target_id ?? null)
		: null;

export function undoneMergeIds(
	entries: readonly SyncJournalEntry[],
): ReadonlySet<number> {
	const unmergedLater = new Set<string>();
	const undone = new Set<number>();
	for (const entry of entries) {
		const unmerged = doneTarget(entry, "unmerge_course");
		if (unmerged !== null) {
			unmergedLater.add(unmerged);
		}
		const merged = doneTarget(entry, "merge_course");
		if (merged !== null && unmergedLater.delete(merged)) {
			undone.add(entry.id);
		}
	}
	return undone;
}

export function unmergeConfirm(targetId: string): Confirm {
	return {
		title: `Роз'єднати дисципліну ${targetId}?`,
		description: `Дисципліна ${targetId} знову стане окремою. Це змінює спільні дані САЗ.`,
	};
}
