// Prototype contract for GET /api/v1/schedule/me/. Django would serve it from
// the semester snapshot the schedule data service publishes, joined with the
// course ratings it already has. Not in the OpenAPI spec yet.

export interface ScheduleCourse {
	readonly id: string;
	readonly title: string;
	/** The student's practical group, or null when the course has only lectures. */
	readonly group: string | null;
	readonly avg_difficulty: number | null;
	readonly avg_usefulness: number | null;
}

export interface ScheduleLesson {
	readonly course_id: string;
	/** 1 = Monday … 5 = Friday. */
	readonly day: number;
	/** Bell slot, 1 = 8:30 … 7 = 18:00. */
	readonly slot: number;
	readonly kind: "lecture" | "group";
	readonly room: string;
}

export interface MySchedule {
	readonly semester: string;
	readonly week: {
		readonly number: number;
		/** ISO date of Monday. */
		readonly starts_on: string;
	};
	readonly calendar_connected: boolean;
	readonly courses: ReadonlyArray<ScheduleCourse>;
	readonly lessons: ReadonlyArray<ScheduleLesson>;
}

export const BELL_SLOTS: Readonly<Record<number, string>> = {
	1: "8:30–9:50",
	2: "10:00–11:20",
	3: "11:40–13:00",
	4: "13:30–14:50",
	5: "15:00–16:20",
	6: "16:30–17:50",
	7: "18:00–19:20",
};

export const WEEKDAYS = [
	"Понеділок",
	"Вівторок",
	"Середа",
	"Четвер",
	"П'ятниця",
] as const;
