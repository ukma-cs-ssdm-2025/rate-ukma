import type {
	CustomLessons,
	DisciplineId,
	GroupLabel,
	InpEntry,
	InpResolution,
	Offering,
	Overrides,
	Selection,
	Week,
} from "@/features/schedule/core";
import {
	isComplete,
	plan,
	planLessons,
	withGroup,
	without,
	type PlanLessons,
} from "@/features/schedule/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	fetchConfig,
	fetchMe,
	logout,
	savePlan,
	setInpMatch,
	type AppConfig,
	type Me,
	type PlanUpdate,
} from "@/features/schedule/lib/api";
import {
	listSemesters,
	loadSemester,
	loadTimetable,
	type Semester,
} from "@/features/schedule/lib/data";
import {
	baseOf,
	displayNamesOf,
	registeredByDisciplineOf,
	resolveInp,
	variantOf,
	weeksOf,
	withForced,
	withRegistered,
} from "@/features/schedule/core";
import { selectPlan, type PlanView } from "@/features/schedule/lib/plan-view";
import { queryKeys } from "@/features/schedule/lib/query";
import { opaqueId, telemetry } from "@/features/schedule/lib/telemetry";
import { currentWeekOf } from "@/features/schedule/lib/weeks";
import { usePlanDraft } from "@/features/schedule/stores/plan";
import {
	useUi,
	type ViewChoice,
	type ViewMode,
} from "@/features/schedule/stores/ui";

export interface Feed {
	readonly url: string;
	readonly google: string;
	/** The same feed as `webcal://`, which Apple's Calendar subscribes to in one tap. */
	readonly apple: string;
	readonly outlook: string;
}

/** «saved» is the quiet default; «saving» covers the debounce and the request; «failed» stays until a retry succeeds. */
export type SaveState = "saved" | "saving" | "failed";

export interface Planner extends PlanView {
	readonly config: AppConfig | undefined;
	readonly semesters: ReadonlyArray<string>;
	readonly me: Me | null | undefined;
	readonly meFetched: boolean;
	readonly semester: Semester | undefined;
	readonly semesterError: unknown;
	readonly semesterLoading: boolean;
	/** The semester failed to load at all. */
	readonly loadError: string | undefined;
	/** Still waiting for the semester or the profile. */
	readonly loading: boolean;
	readonly picked: ReadonlyArray<DisciplineId>;
	readonly selection: Selection;
	/** Disciplines the student hid with the eye: off the grid and out of every export. */
	readonly hidden: ReadonlyArray<DisciplineId>;
	/** Long names as their initials on the grid and in every calendar. */
	readonly shortNames: boolean;
	/** Lessons the student corrected: moved, another room, other weeks, not held. */
	readonly overrides: Overrides;
	/** Lessons the student added by hand because no sheet prints them. */
	readonly custom: CustomLessons;
	/** The timetable, once: grid cells, feed, download and copy all render this. */
	readonly lessons: PlanLessons;
	readonly locked: boolean;
	readonly inp: InpResolution | undefined;
	readonly displayNames: ReadonlyMap<DisciplineId, string>;
	readonly registeredByDiscipline: Readonly<Record<DisciplineId, GroupLabel>>;
	readonly week: Week | undefined;
	readonly view: ViewChoice;
	readonly solo: DisciplineId | undefined;
	readonly setWeek: (week: Week | undefined) => void;
	readonly setView: (view: ViewChoice) => void;
	readonly setSolo: (solo: DisciplineId | undefined) => void;
	readonly weeks: ReadonlyArray<Week>;
	readonly span: { readonly start: string; readonly end: string } | undefined;
	readonly thisWeek: Week | undefined;
	/** «Накладки» exists only while there is something to show in it, and a
	 *  locked plan is its chosen groups alone whatever the toggle says. */
	readonly shownView: ViewMode;
	/** Any semester but the one the server lists first. */
	readonly isArchive: boolean;
	readonly hasSchedule: boolean;
	readonly scheduleEmpty: boolean;
	readonly hasRegistered: boolean;
	readonly feed: Feed;
	readonly switchSemester: (name: string) => void;
	readonly choose: (disciplineId: DisciplineId, group: GroupLabel) => void;
	/** Swap one published stream of an ІНП line for another: the plan keeps
	 *  the line, drops the group chosen in the old stream. */
	readonly switchStream: (from: DisciplineId, to: DisciplineId) => void;
	readonly lockPlan: () => void;
	readonly unlockPlan: () => void;
	readonly resetToSaz: () => void;
	readonly bindInp: (entry: InpEntry, offering: Offering) => Promise<void>;
	readonly signOut: () => void;
	/** Whether the server holds what is on screen. Shown only when it does not. */
	readonly saveState: SaveState;
	readonly retrySave: () => void;
}

/** The queries behind the planner, plus the effects that settle the draft:
 *  hydrate once per student and semester, land on today's week once the plan
 *  is complete, and identify the session for telemetry. */
const usePlannerData = () => {
	const {
		semesterName,
		week,
		view,
		solo,
		setSemesterName,
		setWeek,
		setView,
		setSolo,
		setFocus,
	} = useUi();
	const {
		picked,
		selection,
		hidden,
		shortNames,
		overrides,
		custom,
		locked,
		hydratedFor,
		hydrate,
		updatePicked,
		updateSelection,
		setLocked,
		reset,
	} = usePlanDraft();

	const { data: config } = useQuery({
		queryKey: queryKeys.config,
		queryFn: fetchConfig,
	});
	const { data: semesters = [] } = useQuery({
		queryKey: queryKeys.semesters,
		queryFn: listSemesters,
	});
	// The plan is per semester, so the profile is read again for an archive.
	const { data: me, isFetched: meFetched } = useQuery({
		queryKey: queryKeys.meFor(semesterName),
		queryFn: () => fetchMe(semesterName),
		retry: false,
	});
	// A returning student's grid needs only their slice; the whole semester
	// comes when the slice is not enough (nothing planned, no ІНП, or no slice
	// at all) or when the catalog asks for it (useWholeSemester).
	const timetable = useQuery({
		queryKey: queryKeys.timetable(semesterName),
		queryFn: () => loadTimetable(semesterName),
		enabled: me !== null,
		retry: false,
	});
	const slice =
		timetable.data && timetable.data.offerings.length > 0
			? timetable.data
			: undefined;
	const corpus = useQuery({
		queryKey: queryKeys.semester(semesterName),
		queryFn: () => loadSemester(semesterName),
		enabled:
			timetable.isError ||
			(timetable.isSuccess && timetable.data !== null && !slice),
	});
	const semester = corpus.data ?? slice;
	const semesterError = corpus.error;
	const semesterLoading =
		!semester && (timetable.isLoading || corpus.isLoading);

	// Read the saved plan once the semester and the profile have both arrived.
	useEffect(() => {
		if (semester && me) hydrate(me, semester);
	}, [semester, me, hydrate]);

	// Land on today's week only once every group is chosen; while the plan is
	// still open the whole semester is the view that shows the alternatives.
	// Once per hydration, so neither picking the last group nor the whole
	// semester replacing the slice yanks the grid. The draft is read via
	// getState, so subscribing to its every keystroke does not re-key this.
	const loadedOfferings = semester?.offerings;
	const loadedWeekDates = semester?.weekDates;
	const landedFor = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (!loadedOfferings || !loadedWeekDates || hydratedFor === undefined)
			return;
		if (landedFor.current === hydratedFor) return;
		landedFor.current = hydratedFor;
		const draft = usePlanDraft.getState();
		const pickedIds = new Set(draft.picked);
		const offerings = loadedOfferings.filter(
			(o) =>
				pickedIds.has(o.disciplineId) && !draft.hidden.includes(o.disciplineId),
		);
		const result = plan(offerings);
		const forced = withForced(draft.selection, result);
		setWeek(
			offerings.length > 0 && isComplete(offerings, forced)
				? currentWeekOf(loadedWeekDates, new Date())
				: undefined,
		);
	}, [loadedOfferings, loadedWeekDates, hydratedFor, setWeek]);

	// The sign-in tracks only after the opaque id lands, so it carries the user.
	const previousMe = useRef<Me | null | undefined>(undefined);
	useEffect(() => {
		const previous = previousMe.current;
		previousMe.current = me;
		if (!me) return;
		void opaqueId(me.user.email).then((id) => {
			telemetry.setUser(id);
			if (previous === null) telemetry.track("sign_in");
		});
	}, [me]);
	return {
		semesterName,
		week,
		view,
		solo,
		setSemesterName,
		setWeek,
		setView,
		setSolo,
		setFocus,
		picked,
		selection,
		hidden,
		shortNames,
		overrides,
		custom,
		locked,
		hydratedFor,
		updatePicked,
		updateSelection,
		setLocked,
		reset,
		config,
		semesters,
		me,
		meFetched,
		semester,
		semesterError,
		semesterLoading,
	};
};

/** The catalog searches every sheet, so it brings the whole semester in;
 *  the planner switches to it from the slice as soon as it lands. */
export const useWholeSemester = () => {
	const queryClient = useQueryClient();
	const semesterName = useUi((state) => state.semesterName);
	useEffect(() => {
		void queryClient.prefetchQuery({
			queryKey: queryKeys.semester(semesterName),
			queryFn: () => loadSemester(semesterName),
		});
	}, [queryClient, semesterName]);
};

interface SaveArgs {
	readonly plan: PlanUpdate;
	readonly semester: string;
	readonly cacheKey: string | undefined;
}

/** Persist plan edits, debounced. Only after hydration, only while signed in.
 *  Keyed on the serialized payload, never on values derived during render:
 *  those get a fresh identity each render and the mutation's own re-render
 *  would then schedule the next save forever. The serialized payload guards
 *  against sending the same plan twice. */
const usePlanPersistence = (args: {
	semester: Semester | undefined;
	/** The ui-store name the profile query is keyed on: undefined means current. */
	semesterName: string | undefined;
	me: Me | null | undefined;
	hydratedFor: string | undefined;
	picked: ReadonlyArray<DisciplineId>;
	effective: Selection;
	hidden: ReadonlyArray<DisciplineId>;
	shortNames: boolean;
	overrides: Overrides;
	custom: CustomLessons;
	locked: boolean;
	save: (input: SaveArgs) => void;
}) => {
	const {
		semester,
		semesterName,
		me,
		hydratedFor,
		picked,
		effective,
		hidden,
		shortNames,
		overrides,
		custom,
		locked,
		save,
	} = args;
	const payload = useMemo<PlanUpdate>(
		() => ({
			picked: [...picked],
			selection: effective,
			hidden: [...hidden],
			shortNames,
			overrides,
			custom,
			locked,
		}),
		[picked, effective, hidden, shortNames, overrides, custom, locked],
	);
	const serialized = semester
		? `${semester.name} ${JSON.stringify(payload)}`
		: undefined;
	const lastSaved = useRef<string | undefined>(undefined);
	const baselineFor = useRef<string | undefined>(undefined);
	const [dirty, setDirty] = useState(false);
	useEffect(() => {
		if (
			serialized === undefined ||
			hydratedFor === undefined ||
			!me ||
			!semester
		)
			return;
		// The first payload after hydration of a saved plan is the server's own
		// plan, derived, not edited: the baseline, never a save (and never
		// «Зберігаємо»). A first visit has no saved plan yet; what the ІНП
		// seeded is worth saving, the feed needs it.
		if (baselineFor.current !== hydratedFor) {
			baselineFor.current = hydratedFor;
			if (me.plan.picked.length > 0) {
				lastSaved.current = serialized;
				return;
			}
		}
		if (serialized === lastSaved.current) return;
		setDirty(true);
		const timer = setTimeout(() => {
			lastSaved.current = serialized;
			setDirty(false);
			save({ plan: payload, semester: semester.name, cacheKey: semesterName });
		}, 500);
		return () => clearTimeout(timer);
	}, [serialized, payload, me, semester, semesterName, hydratedFor, save]);
	return { dirty };
};

export const usePlanner = (): Planner => {
	const queryClient = useQueryClient();
	const {
		semesterName,
		week,
		view,
		solo,
		setSemesterName,
		setWeek,
		setView,
		setSolo,
		setFocus,
		picked,
		selection,
		hidden,
		shortNames,
		overrides,
		custom,
		locked,
		hydratedFor,
		updatePicked,
		updateSelection,
		setLocked,
		reset,
		config,
		semesters,
		me,
		meFetched,
		semester,
		semesterError,
		semesterLoading,
	} = usePlannerData();

	const savePlanMutation = useMutation({
		mutationFn: (args: SaveArgs) => savePlan(args.plan, args.semester),
		// No refetch: the server now holds exactly what was sent, and the draft
		// stays the source of truth (hydrate runs once per student and semester).
		// The cache copy is patched to match, so switching semesters and back
		// within gcTime rehydrates the saved picks instead of the pre-edit ones.
		onSuccess: (_, args) => {
			queryClient.setQueryData<Me | null>(
				queryKeys.meFor(args.cacheKey),
				(prev) => {
					if (!prev) return prev;
					return {
						...prev,
						plan: {
							...prev.plan,
							picked: [...args.plan.picked],
							selection: { ...args.plan.selection },
							hidden: [...args.plan.hidden],
							shortNames: args.plan.shortNames,
							overrides: { ...args.plan.overrides },
							custom: [...args.plan.custom],
							locked: args.plan.locked,
						},
					};
				},
			);
			telemetry.track("plan_saved", { locked: args.plan.locked });
			telemetry.measure("plan.disciplines", args.plan.picked.length);
		},
		onError: (_error, args) => {
			telemetry.track("save_failed");
			toast.error("План не збережено", {
				description: "Перевір з’єднання й спробуй ще раз.",
				action: {
					label: "Повторити",
					onClick: () => savePlanMutation.mutate(args),
				},
			});
		},
	});
	const inpMatchMutation = useMutation({
		mutationFn: (args: {
			courseId: string;
			match: string;
			variantLabel: string | undefined;
		}) => setInpMatch(args.courseId, args.match, args.variantLabel),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.me });
		},
	});

	// SAFETY: server /api/me inp entries are already InpEntry-shaped via Schema.
	const inp = useMemo(
		() =>
			semester && me
				? resolveInp(semester, me.inp as ReadonlyArray<InpEntry>, me.programme)
				: undefined,
		[semester, me],
	);
	// Once per student and semester: how the ІНП became a plan. Counts only,
	// never a discipline name.
	const resolvedFor = useRef<string | undefined>(undefined);
	useEffect(() => {
		if (
			!inp ||
			hydratedFor === undefined ||
			resolvedFor.current === hydratedFor
		)
			return;
		resolvedFor.current = hydratedFor;
		const basis: Record<string, number> = {};
		for (const pick of inp.published)
			basis[pick.basis] = (basis[pick.basis] ?? 0) + 1;
		telemetry.track("inp_resolved", {
			published: inp.published.length,
			unpublished: inp.unpublished.length,
			programmeKnown: inp.homeSheet !== undefined,
			...basis,
		});
		telemetry.measure("inp.unpublished", inp.unpublished.length);
		telemetry.measure(
			"inp.alternatives",
			inp.published.filter((pick) => pick.alternatives.length > 0).length,
		);
	}, [inp, hydratedFor]);
	// Sheet cells truncate long names; the ІНП title completes them everywhere.
	const displayNames = useMemo(
		() => displayNamesOf(semester, inp),
		[semester, inp],
	);
	const registeredByDiscipline = useMemo(
		() => registeredByDisciplineOf(inp, me?.plan.registered, picked),
		[inp, me, picked],
	);
	const planView = useMemo(
		() =>
			semester
				? selectPlan(semester, { picked, selection, overrides, custom, hidden })
				: undefined,
		[semester, picked, selection, overrides, custom, hidden],
	);
	const emptyView: PlanView = useMemo(
		() => ({
			pickedOfferings: [],
			result: plan([]),
			effective: {},
			conflicts: { lectures: [], chosen: [], culprits: [] },
			clashCount: 0,
			complete: false,
			remaining: 0,
		}),
		[],
	);
	const {
		pickedOfferings,
		result,
		effective,
		conflicts,
		clashCount,
		complete,
		remaining,
	} = planView ?? emptyView;

	const { dirty } = usePlanPersistence({
		semester,
		semesterName,
		me,
		hydratedFor,
		picked,
		effective,
		hidden,
		shortNames,
		overrides,
		custom,
		locked,
		save: savePlanMutation.mutate,
	});

	const choose = (disciplineId: DisciplineId, group: GroupLabel) => {
		if (locked || !planView) return;
		const solved = planView.result;
		updateSelection((prev) => {
			const current = withForced(prev, solved);
			return current[disciplineId] === group
				? without(current, disciplineId)
				: withGroup(current, disciplineId, group);
		});
		telemetry.track("group_chosen", {
			unpick: effective[disciplineId] === group,
		});
	};

	const switchStream = (from: DisciplineId, to: DisciplineId) => {
		if (locked || from === to) return;
		updatePicked((prev) => prev.map((id) => (id === from ? to : id)));
		updateSelection((prev) => without(prev, from));
		telemetry.track("stream_switched", {
			basis:
				inp?.published.find((pick) => pick.disciplineId === from)?.basis ??
				"chosen",
		});
	};

	// The timetable itself, once: what the grid, the feed and every export show.
	const lessons = useMemo(
		() =>
			planLessons(pickedOfferings, effective, {
				hidden,
				shortNames,
				names: displayNames,
			}),
		[pickedOfferings, effective, hidden, shortNames, displayNames],
	);

	const weeks = useMemo(() => weeksOf(semester), [semester]);
	const span = week !== undefined ? semester?.weekDates.get(week) : undefined;
	const thisWeek = semester
		? currentWeekOf(semester.weekDates, new Date())
		: undefined;

	// An archive is any semester but the one the server lists first. Its ІНП
	// and САЗ records come with the profile like the current one's; only the
	// sign-in sync and the calendar feed are about the current semester.
	const isArchive =
		semester !== undefined &&
		semesters.length > 0 &&
		semester.name !== semesters[0];
	const hasRegistered = !!me && Object.keys(me.plan.registered).length > 0;
	const hasSchedule =
		!!semester && semester.rows.length > 0 && semester.offerings.length > 0;
	const scheduleEmpty = !hasSchedule && !!me && me.inp.length > 0;
	const shownView =
		locked || !planView
			? "chosen"
			: view === "clashes" && clashCount === 0
				? "all"
				: view;

	const feed: Feed = useMemo(() => {
		const url = me ? `${window.location.origin}/ics/${me.icsToken}.ics` : "";
		return {
			url,
			google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url.replace(/^https?:/, "webcal:"))}`,
			apple: url.replace(/^https?:/, "webcal:"),
			outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}&name=${encodeURIComponent("Розклад НаУКМА")}`,
		};
	}, [me]);

	// The current semester is cached under «undefined», not its name: naming
	// it on the way back from an archive would download the corpus again.
	const switchSemester = (name: string) => {
		if (semester && name !== semester.name)
			setSemesterName(name === semesters[0] ? undefined : name);
	};
	// Final: the grid keeps the chosen groups alone, with nothing left to
	// click by accident. The week, the view toggle and the eye toggles stay
	// as they were, so the switch changes what a cell can do, not what the
	// student was looking at.
	const lockPlan = () => {
		setLocked(true);
		setSolo(undefined);
		telemetry.track("plan_locked", { clashes: clashCount });
		telemetry.measure("plan.disciplines", picked.length, { at: "lock" });
	};
	const unlockPlan = () => {
		setLocked(false);
		telemetry.track("plan_unlocked");
	};

	const resetToSaz = () => {
		if (!semester || !inp) return;
		const restored = inp.published.map((item) => item.disciplineId);
		reset(
			restored,
			withRegistered({}, registeredByDiscipline, semester.offerings),
		);
		setSolo(undefined);
		telemetry.track("plan_reset");
	};

	const bindInp = async (entry: InpEntry, offering: Offering) => {
		const variant = variantOf(offering);
		try {
			await inpMatchMutation.mutateAsync({
				courseId: entry.courseId,
				match: baseOf(offering),
				variantLabel: variant,
			});
		} catch {
			toast.error("Не вдалося прив’язати дисципліну");
			return;
		}
		updatePicked((prev) =>
			prev.includes(offering.disciplineId)
				? prev
				: [...prev, offering.disciplineId],
		);
		telemetry.track("inp_bound");
	};

	const saveState: SaveState = savePlanMutation.isError
		? "failed"
		: savePlanMutation.isPending || dirty
			? "saving"
			: "saved";
	const retrySave = () => {
		if (savePlanMutation.variables)
			savePlanMutation.mutate(savePlanMutation.variables);
	};
	// A closing tab with an unsaved plan is the one loss the student cannot see.
	useEffect(() => {
		if (saveState === "saved") return;
		const guard = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", guard);
		return () => window.removeEventListener("beforeunload", guard);
	}, [saveState]);

	const signOut = () => {
		telemetry.track("sign_out");
		telemetry.setUser(null);
		queryClient.setQueryData<Me | null>(queryKeys.meFor(semesterName), null);
		usePlanDraft.getState().clear();
		setFocus(undefined);
		setSolo(undefined);
		void logout().catch(() => {});
	};

	// Student-driven view changes only; the automatic landing uses the raw setter.
	const setWeekTracked = (next: Week | undefined) => {
		telemetry.track("week_switched", { week: next ?? "all" });
		setWeek(next);
	};
	const setViewTracked = (next: ViewChoice) => {
		telemetry.track("view_switched", { view: next });
		setView(next);
	};
	const setSoloTracked = (next: DisciplineId | undefined) => {
		telemetry.track("solo_changed", { on: next !== undefined });
		setSolo(next);
	};

	const loadError =
		semesterError instanceof Error ? semesterError.message : undefined;

	return {
		config,
		semesters,
		me,
		meFetched,
		semester,
		semesterError,
		semesterLoading,
		loadError,
		loading: semesterLoading || !semester || !meFetched,
		picked,
		selection,
		locked,
		inp,
		hidden,
		shortNames,
		overrides,
		custom,
		lessons,
		displayNames,
		registeredByDiscipline,
		pickedOfferings,
		result,
		effective,
		conflicts,
		clashCount,
		complete,
		remaining,
		setWeek: setWeekTracked,
		setView: setViewTracked,
		setSolo: setSoloTracked,
		week,
		view,
		solo,
		weeks,
		span,
		thisWeek,
		shownView,
		isArchive,
		hasSchedule,
		scheduleEmpty,
		hasRegistered,
		feed,
		switchSemester,
		choose,
		switchStream,
		lockPlan,
		unlockPlan,
		resetToSaz,
		bindInp,
		signOut,
		saveState,
		retrySave,
	};
};
