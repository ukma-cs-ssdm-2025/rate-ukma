import { useEffect, useMemo, useState } from "react";
import {
	computeCalendarModel,
	type CalendarModel,
} from "@/features/schedule/lib/calendar-events";
import type { Timetable } from "@/features/schedule/lib/plan-view";
import { usePlanDraft } from "@/features/schedule/stores/plan";
import { useUi } from "@/features/schedule/stores/ui";

/** One instant for the whole grid: today Column and the in-progress slot. */
const useNow = (stepMs = 30_000): Date => {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), stepMs);
		return () => clearInterval(timer);
	}, [stepMs]);
	return now;
};

/** The shared grid model both presentations render: desktop grid and phone pager. */
export const useCalendarModel = (planner: Timetable): CalendarModel => {
	const { hidden } = usePlanDraft();
	const { solo, week } = useUi();
	const now = useNow();
	const { pickedOfferings, result, effective, semester, shownView } = planner;
	return useMemo(() => {
		if (!semester) {
			return {
				events: [],
				clashing: new Map(),
				days: [],
				slots: [],
				dated: [],
				visible: [],
				todayColumn: undefined,
				nowMark: undefined,
				span: undefined,
			} satisfies CalendarModel;
		}
		return computeCalendarModel(
			pickedOfferings,
			result,
			effective,
			semester,
			new Set(hidden),
			solo,
			shownView,
			week,
			now,
		);
	}, [
		semester,
		pickedOfferings,
		result,
		effective,
		hidden,
		solo,
		shownView,
		week,
		now,
	]);
};
