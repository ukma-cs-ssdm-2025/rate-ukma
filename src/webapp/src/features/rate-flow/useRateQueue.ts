import { useCallback, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { getSemesterDisplay } from "@/features/courses/courseFormatting";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import {
	getStudentsMeGradesRetrieveQueryKey,
	useCoursesRatingsCreate,
	useStudentsMeGradesRetrieve,
} from "@/lib/api/generated";

export interface QueueItem {
	readonly offeringId: string;
	readonly courseId: string;
	readonly title: string;
	readonly facultyName: string;
	readonly semesterKey: string;
	readonly semesterLabel: string;
}

export interface Scores {
	readonly difficulty: number;
	readonly usefulness: number;
}

export type ItemState =
	| { readonly kind: "todo" }
	| { readonly kind: "skipped" }
	| { readonly kind: "done"; readonly scores: Scores };

export interface SemesterBucket {
	readonly key: string;
	readonly label: string;
	readonly items: readonly QueueItem[];
}

const TERM_RANK: Record<string, number> = { SPRING: 1, SUMMER: 2, FALL: 3 };

function semesterRank(item: StudentRatingsDetailed): number {
	const year = item.semester?.year ?? 0;
	const season = item.semester?.season?.toUpperCase() ?? "";
	return year * 10 + (TERM_RANK[season] ?? 0);
}

function toQueueItem(item: StudentRatingsDetailed): QueueItem {
	const year = item.semester?.year ?? 0;
	const season = item.semester?.season ?? "";
	return {
		offeringId: item.course_offering_id ?? "",
		courseId: item.course_id ?? "",
		title: item.course_title ?? "",
		facultyName: item.faculty_name ?? "",
		semesterKey: `${year}-${season}`,
		semesterLabel: getSemesterDisplay(year, season),
	};
}

/**
 * Every course the student took and can rate but has not, newest term first.
 * The list is frozen on first load so rating a course keeps its place in the
 * queue instead of the refetch pulling it out from under the student.
 */
export function useRateQueue() {
	const queryClient = useQueryClient();
	const { data, isLoading } = useStudentsMeGradesRetrieve();
	const createRating = useCoursesRatingsCreate();

	const fresh = useMemo<QueueItem[]>(() => {
		const rows = Array.isArray(data) ? data : data ? [data] : [];
		return rows
			.filter((row) => row.can_rate && !row.rated)
			.sort((a, b) => semesterRank(b) - semesterRank(a))
			.map(toQueueItem);
	}, [data]);

	const [frozen, setFrozen] = useState<QueueItem[] | null>(null);
	if (frozen === null && fresh.length > 0) setFrozen(fresh);
	const items = frozen ?? fresh;

	const [states, setStates] = useState<Record<string, ItemState>>({});
	const stateOf = useCallback(
		(item: QueueItem): ItemState => states[item.offeringId] ?? { kind: "todo" },
		[states],
	);

	const semesters = useMemo<SemesterBucket[]>(() => {
		const buckets = new Map<string, SemesterBucket>();
		for (const item of items) {
			const bucket = buckets.get(item.semesterKey) ?? {
				key: item.semesterKey,
				label: item.semesterLabel,
				items: [],
			};
			buckets.set(item.semesterKey, {
				...bucket,
				items: [...bucket.items, item],
			});
		}
		return [...buckets.values()];
	}, [items]);

	const save = useCallback(
		async (
			item: QueueItem,
			scores: Scores,
			extra: { comment?: string; isAnonymous?: boolean } = {},
		) => {
			await createRating.mutateAsync({
				courseId: item.courseId,
				data: {
					course_offering: item.offeringId,
					difficulty: scores.difficulty,
					usefulness: scores.usefulness,
					comment: extra.comment?.trim() || undefined,
					is_anonymous: extra.isAnonymous ?? true,
				},
			});
			setStates((prev) => ({
				...prev,
				[item.offeringId]: { kind: "done", scores },
			}));
		},
		[createRating],
	);

	const skip = useCallback((item: QueueItem) => {
		setStates((prev) => ({ ...prev, [item.offeringId]: { kind: "skipped" } }));
	}, []);

	const finish = useCallback(
		() =>
			queryClient.invalidateQueries({
				queryKey: getStudentsMeGradesRetrieveQueryKey(),
			}),
		[queryClient],
	);

	const doneCount = items.filter(
		(item) => stateOf(item).kind === "done",
	).length;
	const nextTodo = (after?: QueueItem) => {
		// `after` was just saved or skipped; state updates land next render.
		const open = (item: QueueItem) =>
			item !== after && stateOf(item).kind === "todo";
		const start = after ? items.indexOf(after) + 1 : 0;
		return items.slice(start).find(open) ?? items.find(open) ?? null;
	};

	return {
		items,
		semesters,
		isLoading,
		isSaving: createRating.isPending,
		stateOf,
		save,
		skip,
		finish,
		doneCount,
		nextTodo,
	};
}

export type RateQueue = ReturnType<typeof useRateQueue>;
