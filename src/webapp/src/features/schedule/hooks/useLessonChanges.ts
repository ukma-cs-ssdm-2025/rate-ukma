import type { LessonChange } from "@/features/schedule/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { toast } from "sonner";
import {
	fetchChanges,
	markChangesSeen,
	type LessonChanges,
} from "@/features/schedule/lib/api";
import {
	NO_MARKS,
	marksOf,
	type ChangeMarks,
} from "@/features/schedule/lib/lesson-changes";
import { queryKeys } from "@/features/schedule/lib/query";
import { telemetry } from "@/features/schedule/lib/telemetry";
import { useUi } from "@/features/schedule/stores/ui";

export interface LessonChangesView {
	readonly changes: ReadonlyArray<LessonChange>;
	/** When the reading the changes are counted to was taken. */
	readonly toAt: string | null;
	readonly marks: ChangeMarks;
	/** «Зрозуміло»: the changes are seen and leave the grid. */
	readonly dismiss: () => void;
}

/** The grid's marks, provided where the planner renders the grid; a shared
 *  timetable has none. */
export const ChangeMarksContext = createContext<ChangeMarks>(NO_MARKS);
export const useChangeMarks = (): ChangeMarks => useContext(ChangeMarksContext);

/** What the faculty changed in the student's lessons since they last said
 *  they saw it. Read once per visit; dismissing clears it at once and tells
 *  the server which reading was seen. */
export const useLessonChanges = (enabled: boolean): LessonChangesView => {
	const semesterName = useUi((state) => state.semesterName);
	const queryClient = useQueryClient();
	const key = queryKeys.changes(semesterName);
	const { data } = useQuery({
		queryKey: key,
		queryFn: () => fetchChanges(semesterName),
		enabled,
		staleTime: Infinity,
	});
	const seen = useMutation({
		mutationFn: (ingestId: number) => markChangesSeen(ingestId, semesterName),
		onMutate: (ingestId) => {
			queryClient.setQueryData<LessonChanges>(key, (prev) =>
				prev ? { ...prev, fromIngestId: ingestId, changes: [] } : prev,
			);
		},
		onError: () => {
			void queryClient.invalidateQueries({ queryKey: key });
			toast.error("Не вдалося позначити зміни переглянутими");
		},
	});
	const changes = useMemo(() => data?.changes ?? [], [data]);
	const marks = useMemo(() => marksOf(changes), [changes]);
	const dismiss = () => {
		const to = data?.toIngestId;
		if (to === undefined || to === null) return;
		telemetry.track("changes_seen", { count: changes.length });
		seen.mutate(to);
	};
	return { changes, toAt: data?.toAt ?? null, marks, dismiss };
};
