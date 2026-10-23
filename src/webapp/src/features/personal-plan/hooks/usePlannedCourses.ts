import { useCallback, useSyncExternalStore } from "react";

import { localStorageAdapter } from "@/lib/storage";
import {
	addCourse,
	demoteToBackup,
	EMPTY_PLAN,
	planStorageKey,
	promoteBackup,
	readStoredPlan,
	removeCourse,
	type StoredPlan,
} from "../planStore";
import type { PlanCourse, PlanSlot, PlanTarget } from "../planTypes";

// One copy of each user's plan for the whole app, so the course page's
// «Додати в ІНП» and the plan page always agree.
const cache = new Map<number, StoredPlan>();
const listeners = new Set<() => void>();

function readPlan(userId: number | undefined): StoredPlan {
	if (userId == null) return EMPTY_PLAN;
	let plan = cache.get(userId);
	if (!plan) {
		plan = readStoredPlan(
			localStorageAdapter.getItem<StoredPlan>(planStorageKey(userId)),
		);
		cache.set(userId, plan);
	}
	return plan;
}

function writePlan(userId: number, plan: StoredPlan) {
	cache.set(userId, plan);
	localStorageAdapter.setItem(planStorageKey(userId), plan);
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	// Another tab changed the plan: drop the stale copy.
	const onStorage = () => {
		cache.clear();
		listener();
	};
	globalThis.addEventListener?.("storage", onStorage);
	return () => {
		listeners.delete(listener);
		globalThis.removeEventListener?.("storage", onStorage);
	};
}

/**
 * The student's picks, kept in localStorage per user. Swap the store for API
 * calls once the backend keeps plans; the returned shape is what pages use.
 */
export function usePlannedCourses(userId: number | undefined) {
	const plan = useSyncExternalStore(
		subscribe,
		() => readPlan(userId),
		() => EMPTY_PLAN,
	);

	const update = useCallback(
		(change: (current: StoredPlan) => StoredPlan) => {
			if (userId == null) return;
			writePlan(userId, change(readPlan(userId)));
		},
		[userId],
	);

	return {
		planned: plan.semesters,
		add: useCallback(
			(target: PlanTarget, course: PlanCourse, slot: PlanSlot) =>
				update((current) => addCourse(current, target, course, slot)),
			[update],
		),
		remove: useCallback(
			(target: PlanTarget, courseId: string) =>
				update((current) => removeCourse(current, target, courseId)),
			[update],
		),
		promote: useCallback(
			(target: PlanTarget, courseId: string) =>
				update((current) => promoteBackup(current, target, courseId)),
			[update],
		),
		demote: useCallback(
			(target: PlanTarget, courseId: string) =>
				update((current) => demoteToBackup(current, target, courseId)),
			[update],
		),
	};
}

export type PlanActions = Omit<ReturnType<typeof usePlannedCourses>, "planned">;
