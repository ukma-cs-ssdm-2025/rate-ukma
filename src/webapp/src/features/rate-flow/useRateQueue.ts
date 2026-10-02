import { useCallback, useEffect, useMemo, useState } from "react";

import { getSemesterDisplay } from "@/features/courses/courseFormatting";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { useStudentsMeGradesRetrieve } from "@/lib/api/generated";

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

const STORAGE_KEY = "rate-ukma:rate-queue";

interface SavedQueue {
	readonly items: QueueItem[];
	readonly states: Record<string, ItemState>;
}

function sessionStore(): Storage | null {
	try {
		return globalThis.sessionStorage ?? null;
	} catch {
		return null;
	}
}

function readSaved(): SavedQueue | null {
	try {
		const raw = sessionStore()?.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as SavedQueue) : null;
	} catch {
		return null;
	}
}

function writeSaved(saved: SavedQueue | null) {
	try {
		if (saved) sessionStore()?.setItem(STORAGE_KEY, JSON.stringify(saved));
		else sessionStore()?.removeItem(STORAGE_KEY);
	} catch {
		// Storage can be full or blocked; the queue still works for this visit.
	}
	globalThis.dispatchEvent?.(new Event(SAVED_EVENT));
}

const SAVED_EVENT = "rate-queue-saved";

export interface SavedProgress {
	readonly rated: number;
	readonly total: number;
	readonly remaining: number;
}

function progressOf(saved: SavedQueue | null): SavedProgress | null {
	if (!saved) return null;
	const kinds = saved.items.map(
		(item) => saved.states[item.offeringId]?.kind ?? "todo",
	);
	const remaining = kinds.filter((kind) => kind === "todo").length;
	if (remaining === 0) return null;
	return {
		rated: kinds.filter((kind) => kind === "done").length,
		total: saved.items.length,
		remaining,
	};
}

/**
 * A queue the student started this session and left with courses to go,
 * so another page can offer the way back.
 */
export function useSavedRateProgress(): SavedProgress | null {
	const [progress, setProgress] = useState(() => progressOf(readSaved()));
	useEffect(() => {
		const sync = () => setProgress(progressOf(readSaved()));
		globalThis.addEventListener(SAVED_EVENT, sync);
		return () => globalThis.removeEventListener(SAVED_EVENT, sync);
	}, []);
	return progress;
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
 * The saved order, minus courses rated elsewhere since, plus any that opened
 * since; without a save, just the fresh list.
 */
function restore(saved: SavedQueue | null, fresh: QueueItem[]): QueueItem[] {
	if (!saved) return fresh;
	const open = new Set(fresh.map((item) => item.offeringId));
	const kept = saved.items.filter(
		(item) =>
			open.has(item.offeringId) ||
			(saved.states[item.offeringId]?.kind ?? "todo") !== "todo",
	);
	const known = new Set(kept.map((item) => item.offeringId));
	return [...kept, ...fresh.filter((item) => !known.has(item.offeringId))];
}

/**
 * Every course the student took and can rate but has not, newest term first.
 * The list is frozen on first load so rating a course keeps its place in the
 * queue instead of the refetch pulling it out from under the student.
 */
export function useRateQueue() {
	const { data, isLoading, isError, refetch, isRefetching } =
		useStudentsMeGradesRetrieve();

	const fresh = useMemo<QueueItem[]>(() => {
		const rows = Array.isArray(data) ? data : data ? [data] : [];
		return rows
			.filter((row) => row.can_rate && !row.rated)
			.sort((a, b) => semesterRank(b) - semesterRank(a))
			.map(toQueueItem);
	}, [data]);

	// A visit to a course's reviews mid-queue comes back to the same place.
	const [saved] = useState(readSaved);
	const [frozen, setFrozen] = useState<QueueItem[] | null>(null);
	const [states, setStates] = useState<Record<string, ItemState>>(
		() => saved?.states ?? {},
	);
	if (frozen === null && fresh.length > 0) {
		setFrozen(restore(saved, fresh));
	}
	const items = frozen ?? fresh;

	const nothingOpen = !isLoading && !isError && fresh.length === 0;
	useEffect(() => {
		// Rated elsewhere since: nothing left to come back to.
		if (nothingOpen && frozen === null) writeSaved(null);
	}, [nothingOpen, frozen]);

	useEffect(() => {
		if (frozen === null) return;
		const started = Object.keys(states).length > 0;
		const open = frozen.some(
			(item) => (states[item.offeringId]?.kind ?? "todo") === "todo",
		);
		writeSaved(started && open ? { items: frozen, states } : null);
	}, [frozen, states]);
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

	const markDone = useCallback((item: QueueItem, scores: Scores) => {
		setStates((prev) => ({
			...prev,
			[item.offeringId]: { kind: "done", scores },
		}));
	}, []);

	const skip = useCallback((item: QueueItem) => {
		setStates((prev) => ({ ...prev, [item.offeringId]: { kind: "skipped" } }));
	}, []);

	/** Back to the start of the skipped courses, for the end screen. */
	const unskipAll = useCallback(() => {
		setStates((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(([, state]) => state.kind !== "skipped"),
			),
		);
	}, []);

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
		isError,
		refetch,
		isRefetching,
		stateOf,
		markDone,
		skip,
		unskipAll,
		doneCount,
		nextTodo,
	};
}

export type RateQueue = ReturnType<typeof useRateQueue>;
