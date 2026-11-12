import { useCallback, useMemo } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
	getStudentsMePlanRetrieveQueryKey,
	type PlanCoursePutRequest,
	type PlanSlot,
	useStudentsMePlanCoursesDestroy,
	useStudentsMePlanCoursesUpdate,
} from "@/lib/api/generated";

/** Where a course goes when picked: one semester of one study year. */
export type PlanTarget = Pick<
	PlanCoursePutRequest,
	"study_year" | "semester_term"
>;

const showError = () =>
	toast.error("Не вдалося оновити ІНП. Спробуйте ще раз.");

/** Changes to the plan; the backend decides where a course really lands. */
export function usePlanActions() {
	const queryClient = useQueryClient();
	const queryKey = getStudentsMePlanRetrieveQueryKey();

	const placeCourse = useStudentsMePlanCoursesUpdate({
		mutation: {
			onSuccess: (plan) => queryClient.setQueryData(queryKey, plan),
			onError: showError,
		},
	});
	const dropCourse = useStudentsMePlanCoursesDestroy({
		mutation: {
			onSuccess: () => queryClient.invalidateQueries({ queryKey }),
			onError: showError,
		},
	});
	const { mutate: place } = placeCourse;
	const { mutate: drop } = dropCourse;

	const add = useCallback(
		(
			target: PlanTarget,
			courseId: string,
			slot: PlanSlot,
			onDone?: () => void,
		) =>
			place(
				{ courseId, data: { ...target, slot } },
				{ onSuccess: () => onDone?.() },
			),
		[place],
	);
	const remove = useCallback(
		(courseId: string, onDone?: () => void) =>
			drop({ courseId }, { onSuccess: () => onDone?.() }),
		[drop],
	);
	const promote = useCallback(
		(target: PlanTarget, courseId: string) => add(target, courseId, "MAIN"),
		[add],
	);
	const demote = useCallback(
		(target: PlanTarget, courseId: string) => add(target, courseId, "BACKUP"),
		[add],
	);

	const isSaving = placeCourse.isPending || dropCourse.isPending;
	return useMemo(
		() => ({ add, remove, promote, demote, isSaving }),
		[add, remove, promote, demote, isSaving],
	);
}

export type PlanActions = ReturnType<typeof usePlanActions>;
