import type {
	CustomLesson,
	CustomLessons,
	DisciplineId,
	Override,
	Overrides,
	Selection,
} from "@/features/schedule/core";
import { create } from "zustand";
import { telemetry } from "@/features/schedule/lib/telemetry";
import type { Me } from "@/features/schedule/lib/api";
import type { Semester } from "@/features/schedule/lib/data";
import {
	brandIds,
	brandRecord,
	registeredByDisciplineOf,
	resolveInp,
	withRegistered,
} from "@/features/schedule/core";
import type { InpEntry } from "@/features/schedule/core";

/** One draft belongs to one student and one semester; either change reloads it. */
const keyOf = (me: Me, semester: Semester) =>
	`${me.user.email} ${semester.name}`;

/** Everything a plan-wide change can touch, to put back on «Повернути». */
export interface PlanSnapshot {
	readonly picked: ReadonlyArray<DisciplineId>;
	readonly selection: Selection;
	readonly hidden: ReadonlyArray<DisciplineId>;
	readonly overrides: Overrides;
	readonly custom: CustomLessons;
}

interface PlanState {
	readonly picked: ReadonlyArray<DisciplineId>;
	readonly selection: Selection;
	/** Disciplines the student hid with the eye toggle; the grid and the feed skip them. */
	readonly hidden: ReadonlyArray<DisciplineId>;
	/** Long names as their initials (БПП) on the grid and in every calendar. */
	readonly shortNames: boolean;
	/** Lessons corrected by hand, keyed by the printed lesson (`lessonKey`). */
	readonly overrides: Overrides;
	/** Lessons added by hand because no sheet prints them. */
	readonly custom: CustomLessons;
	/** Final for the student: the grid shows their groups alone and takes no clicks. */
	readonly locked: boolean;
	/** Key the draft was loaded for; undefined means nothing is loaded yet. */
	readonly hydratedFor: string | undefined;
	setPicked: (picked: ReadonlyArray<DisciplineId>) => void;
	setSelection: (selection: Selection) => void;
	updatePicked: (
		fn: (prev: ReadonlyArray<DisciplineId>) => ReadonlyArray<DisciplineId>,
	) => void;
	updateSelection: (fn: (prev: Selection) => Selection) => void;
	toggleHidden: (id: DisciplineId) => void;
	setShortNames: (shortNames: boolean) => void;
	/** Set or drop corrections by key in one step: a part of a lesson is one
	 *  key per week, and a whole-lesson edit also drops its pre-weeks key. */
	setOverrides: (
		changes: ReadonlyArray<readonly [string, Override | undefined]>,
	) => void;
	/** Add the lesson, or replace the one with its id. */
	saveCustom: (lesson: CustomLesson) => void;
	/** Drop lessons by id. */
	removeCustom: (ids: ReadonlyArray<string>) => void;
	setLocked: (locked: boolean) => void;
	reset: (picked: ReadonlyArray<DisciplineId>, selection: Selection) => void;
	snapshot: () => PlanSnapshot;
	restore: (snapshot: PlanSnapshot) => void;
	/** Read the server copy into the draft once per student and semester. True when it loaded. */
	hydrate: (me: Me, semester: Semester) => boolean;
	clear: () => void;
}

export const usePlanDraft = create<PlanState>((set, get) => ({
	picked: [],
	selection: {},
	hidden: [],
	shortNames: false,
	overrides: {},
	custom: [],
	locked: false,
	hydratedFor: undefined,
	setPicked: (picked) => set({ picked }),
	setSelection: (selection) => set({ selection }),
	updatePicked: (fn) => set((state) => ({ picked: fn(state.picked) })),
	updateSelection: (fn) => set((state) => ({ selection: fn(state.selection) })),
	toggleHidden: (id) =>
		set((state) => {
			const hide = !state.hidden.includes(id);
			telemetry.track("discipline_hidden", { hide });
			return {
				hidden: hide
					? [...state.hidden, id]
					: state.hidden.filter((kept) => kept !== id),
			};
		}),
	setLocked: (locked) => set({ locked }),
	setShortNames: (shortNames) => set({ shortNames }),
	setOverrides: (changes) =>
		set((state) => {
			const targets = changes.flatMap(([, target]) => (target ? [target] : []));
			telemetry.track("lesson_moved", {
				restore: targets.length === 0,
				cancelled: targets.some((target) => target.weeks?.length === 0),
				weeks: changes.length,
			});
			const touched = new Set(changes.map(([key]) => key));
			const kept = Object.entries(state.overrides).filter(
				([key]) => !touched.has(key),
			);
			const added = changes.flatMap(([key, target]) =>
				target ? [[key, target] as const] : [],
			);
			return { overrides: Object.fromEntries([...kept, ...added]) };
		}),
	saveCustom: (lesson) =>
		set((state) => {
			const known = state.custom.some((kept) => kept.id === lesson.id);
			telemetry.track("custom_lesson_saved", { edit: known });
			return {
				custom: known
					? state.custom.map((kept) => (kept.id === lesson.id ? lesson : kept))
					: [...state.custom, lesson],
			};
		}),
	removeCustom: (ids) =>
		set((state) => {
			telemetry.track("custom_lesson_removed", { count: ids.length });
			return { custom: state.custom.filter((kept) => !ids.includes(kept.id)) };
		}),
	reset: (picked, selection) => set({ picked, selection, hidden: [] }),
	snapshot: () => {
		const { picked, selection, hidden, overrides, custom } = get();
		return { picked, selection, hidden, overrides, custom };
	},
	restore: (snapshot) => set(snapshot),
	hydrate: (me, semester) => {
		const key = keyOf(me, semester);
		if (get().hydratedFor === key) return false;
		const stored = brandIds(me.plan.picked);
		// SAFETY: server /api/me inp entries are already InpEntry-shaped via Schema.
		const inpEntries = me.inp as ReadonlyArray<InpEntry>;
		const inp = resolveInp(semester, inpEntries, me.programme);
		const fromInp =
			stored.length > 0 || me.inp.length === 0
				? stored
				: inp.published.map((item) => item.disciplineId);
		// What САЗ has recorded is a fact the plan starts from: a registered
		// discipline is in the plan, and its group is chosen unless the student
		// already chose one by hand.
		const registered = registeredByDisciplineOf(
			inp,
			me.plan.registered,
			fromInp,
		);
		const fromInpSet = new Set(fromInp);
		const offeringIds = new Set(semester.offerings.map((o) => o.disciplineId));
		const picked = [
			...fromInp,
			...brandIds(Object.keys(registered)).filter((id) => {
				if (fromInpSet.has(id)) return false;
				return offeringIds.has(id);
			}),
		];
		const selection = withRegistered(
			brandRecord(me.plan.selection),
			registered,
			semester.offerings,
		);
		set({
			picked,
			selection,
			hidden: brandIds(me.plan.hidden ?? []),
			shortNames: me.plan.shortNames === true,
			overrides: me.plan.overrides ?? {},
			custom: me.plan.custom ?? [],
			locked: me.plan.locked === true,
			hydratedFor: key,
		});
		return true;
	},
	clear: () =>
		set({
			picked: [],
			selection: {},
			hidden: [],
			shortNames: false,
			overrides: {},
			custom: [],
			locked: false,
			hydratedFor: undefined,
		}),
}));
