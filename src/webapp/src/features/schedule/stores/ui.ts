import type {
	CustomLesson,
	DisciplineId,
	LessonRow,
	Week,
} from "@/features/schedule/core";
import { create } from "zustand";

/** What the grid shows: every group, only the ones chosen, or only the clashes. */
export type ViewMode = "all" | "chosen" | "clashes";
/** What the student can ask for. «chosen» is what «Перегляд» shows; it is never picked directly. */
export type ViewChoice = Exclude<ViewMode, "chosen">;

/** The lesson the editor is open on: a sheet lesson to correct, or the
 *  student's own lesson, new (seeded with a name and an ІНП line) or saved. */
export type LessonEdit =
	| { readonly kind: "sheet"; readonly row: LessonRow; readonly name: string }
	| {
			readonly kind: "own";
			readonly lesson?: CustomLesson;
			readonly name?: string;
			readonly courseId?: string;
	  };

interface UiState {
	/** Semester on screen; undefined means the one the server calls current. */
	readonly semesterName: string | undefined;
	readonly week: Week | undefined;
	readonly focus: DisciplineId | undefined;
	readonly solo: DisciplineId | undefined;
	readonly view: ViewChoice;
	readonly editing: LessonEdit | undefined;
	/** Bumped by «Сьогодні»: the grid and the agenda scroll to today even
	 *  when the week on screen is already this one. */
	readonly todayTick: number;
	setSemesterName: (semesterName: string | undefined) => void;
	setWeek: (week: Week | undefined) => void;
	setFocus: (focus: DisciplineId | undefined) => void;
	setSolo: (solo: DisciplineId | undefined) => void;
	setView: (view: ViewChoice) => void;
	setEditing: (editing: LessonEdit | undefined) => void;
	/** «Сьогодні» was asked for: bring today into view again. */
	bumpToday: () => void;
}

export const useUi = create<UiState>((set) => ({
	semesterName: undefined,
	week: undefined,
	focus: undefined,
	solo: undefined,
	view: "all",
	editing: undefined,
	todayTick: 0,
	setSemesterName: (semesterName) => set({ semesterName }),
	setWeek: (week) => set({ week }),
	setFocus: (focus) => set({ focus }),
	setSolo: (solo) => set({ solo }),
	setView: (view) => set({ view }),
	setEditing: (editing) => set({ editing }),
	bumpToday: () => set((state) => ({ todayTick: state.todayTick + 1 })),
}));
