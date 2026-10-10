import type { DisciplineId, Plan } from "@/features/schedule/core";
import {
	brandIds,
	brandRecord,
	customOfferings,
	isComplete,
	plan,
	planLessons,
	weeksOf,
	withForced,
	withOverrides,
} from "@/features/schedule/core";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { PlannerCalendar } from "@/features/schedule/components/PlannerCalendar";
import { SEGMENT, SEGMENTED } from "@/features/schedule/components/Toolbar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Exports } from "@/features/schedule/hooks/useExports";
import { useExports } from "@/features/schedule/hooks/useExports";
import type { Timetable } from "@/features/schedule/lib/plan-view";
import { loadSemester } from "@/features/schedule/lib/data";
import { nodeAsPng, saveBlob } from "@/features/schedule/lib/download";
import { planAsText } from "@/features/schedule/lib/export";
import { copyTextSilent } from "@/features/schedule/lib/clipboard";
import { formatSpan } from "@/features/schedule/lib/format";
import { queryKeys } from "@/features/schedule/lib/query";
import {
	fetchSharedPlan,
	sharedTokenOf,
	type SharedPlan,
} from "@/features/schedule/lib/share";
import { currentWeekOf, stepWeek } from "@/features/schedule/lib/weeks";
import { useUi } from "@/features/schedule/stores/ui";

/** The link token when the address bar opens a shared timetable. */
export const useSharedToken = (): string | undefined => {
	const [hash, setHash] = useState(() => window.location.hash);
	useEffect(() => {
		const onChange = (): void => setHash(window.location.hash);
		window.addEventListener("hashchange", onChange);
		return () => window.removeEventListener("hashchange", onChange);
	}, []);
	return sharedTokenOf(hash);
};

/**
 * A shared timetable, read-only: the owner's picks and groups on the same
 * grid, with week controls and one-shot copies but no rail, no edits, no
 * sign-in and no feed subscription.
 */
export function SharedPlanView(props: { token: string }) {
	const { token } = props;
	const setWeek = useUi((state) => state.setWeek);

	const {
		data: shared,
		isLoading: sharedLoading,
		isError: sharedFailed,
	} = useQuery({
		queryKey: [...queryKeys.semester(undefined), "shared", token],
		queryFn: () => fetchSharedPlan(token),
		retry: false,
	});

	const { data: semester } = useQuery({
		queryKey: queryKeys.semester(shared?.semesterName),
		queryFn: () => loadSemester(shared?.semesterName),
		enabled: shared !== undefined && shared !== null,
	});

	// SAFETY: the shared plan round-trips through our own PUT /api/me/plan
	// writes, like the branded casts in stores/plan.ts. Hidden disciplines
	// leave the offerings before the grid ever sees them: the calendar model
	// reads hidden from the edit store, which stays empty on a shared page.
	const picked = useMemo(
		() => (shared ? brandIds(shared.plan.picked) : []),
		[shared],
	);
	const selection = useMemo(
		() => (shared ? brandRecord(shared.plan.selection) : {}),
		[shared],
	);
	const hidden = useMemo(
		() => new Set(shared ? brandIds(shared.plan.hidden) : []),
		[shared],
	);

	// The owner's corrections and own lessons are part of their timetable:
	// a lesson they moved is where they said, not where the sheet prints it.
	const pickedOfferings = useMemo(() => {
		if (!semester || !shared) return [];
		const ids = new Set(picked);
		return withOverrides(
			[
				...semester.offerings.filter((offering) =>
					ids.has(offering.disciplineId),
				),
				...customOfferings(shared.plan.custom ?? []),
			].filter((offering) => !hidden.has(offering.disciplineId)),
			shared.plan.overrides ?? {},
		);
	}, [semester, shared, picked, hidden]);

	const result: Plan = useMemo(() => plan(pickedOfferings), [pickedOfferings]);
	const effective = useMemo(
		() => withForced(selection, result),
		[selection, result],
	);
	const names = useMemo(() => new Map<DisciplineId, string>(), []);
	const complete = useMemo(
		() => pickedOfferings.length > 0 && isComplete(pickedOfferings, effective),
		[pickedOfferings, effective],
	);
	const lessons = useMemo(
		() =>
			planLessons(pickedOfferings, effective, {
				hidden: [],
				shortNames: shared?.plan.shortNames ?? false,
			}),
		[pickedOfferings, effective, shared],
	);
	const weeks = useMemo(() => weeksOf(semester), [semester]);
	const week = useUi((state) => state.week);
	const span = week !== undefined ? semester?.weekDates.get(week) : undefined;
	const thisWeek = semester
		? currentWeekOf(semester.weekDates, new Date())
		: undefined;

	// Land on today's week once the timetable arrives; later switches are the reader's.
	const landed = useRef(false);
	useEffect(() => {
		if (!semester || !complete || landed.current) return;
		landed.current = true;
		setWeek(currentWeekOf(semester.weekDates, new Date()));
	}, [semester, complete, setWeek]);

	// The grid reads only the timetable fields: picks, solution, labels, frame
	// and week. The planner's editing half has no equivalent here.
	const planner: Timetable = useMemo(
		() => ({
			pickedOfferings,
			result,
			effective,
			lessons,
			semester,
			displayNames: names,
			weeks,
			week,
			span,
			thisWeek,
			shownView: "chosen",
			inp: undefined,
			switchStream: () => {},
		}),
		[
			pickedOfferings,
			result,
			effective,
			lessons,
			semester,
			names,
			weeks,
			week,
			span,
			thisWeek,
		],
	);
	const exports = useExports(planner);

	if (sharedLoading || shared === undefined) {
		return <SharedPending />;
	}

	if (sharedFailed) {
		return (
			<div role="alert" className="mx-auto max-w-xl p-10 text-center">
				<p className="text-sm font-medium text-foreground">
					Не вдалося завантажити розклад
				</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Спробуй оновити сторінку. Якщо посилання застаріло, попроси нове.
				</p>
				<Button variant="link" size="xs" asChild className="mt-2">
					<a href="/">На головну</a>
				</Button>
			</div>
		);
	}

	if (shared === null) {
		return (
			<div
				className="mx-auto max-w-xl p-10 text-center"
				data-testid="shared-missing"
			>
				<p className="text-sm font-medium text-foreground">
					Такого посилання немає
				</p>
				<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
					Можливо, доступ скасовано або в посиланні помилка. Попроси власника
					надіслати нове.
				</p>
				<Button variant="link" size="xs" asChild className="mt-2">
					<a href="/">На головну</a>
				</Button>
			</div>
		);
	}

	if (!semester) {
		return <SharedPending />;
	}

	return <SharedShell shared={shared} planner={planner} exports={exports} />;
}

/** `SharedShell` while the link and the semester load: the header and the
 *  footer stand where they will stay, so the timetable arrives without a jump. */
function SharedPending() {
	return (
		<div className="flex h-svh flex-col bg-card">
			<div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-border/70 px-3 py-1.5">
				<Skeleton className="h-8 w-20" />
				<Skeleton className="h-4 w-48" />
				<Skeleton className="ml-auto h-8 w-72 max-md:hidden" />
			</div>
			<div
				className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
				role="status"
			>
				<Loader2 className="size-4 animate-spin" /> Завантаження розкладу…
			</div>
			<footer className="shrink-0 border-t border-border/70 px-4 py-2 text-center text-xs text-muted-foreground">
				Це копія розкладу лише для перегляду. Зміни в плані власника тут не
				оновляться самі.
			</footer>
		</div>
	);
}

function SharedShell(props: {
	shared: SharedPlan;
	planner: Timetable;
	exports: Exports;
}) {
	const { shared, planner, exports } = props;
	const week = useUi((state) => state.week);
	const setWeek = useUi((state) => state.setWeek);
	const weeks = planner.weeks;
	const previous = stepWeek(weeks, week, -1);
	const next = stepWeek(weeks, week, 1);
	const thisWeek = planner.thisWeek;
	const semester = planner.semester;
	if (!semester) return null;

	const copyText = async (): Promise<void> => {
		if (
			await copyTextSilent(
				planAsText(semester.name, planner.lessons, semester.weekDates),
			)
		) {
			toast.success("Текст скопійовано");
		} else {
			toast.error("Не вдалося скопіювати");
		}
	};
	const copyPng = async (): Promise<void> => {
		const node = exports.gridRef.current ?? exports.phoneRef.current;
		if (!node) return;
		await nodeAsPng(node).then(
			(png) => {
				saveBlob(png, "ukma-rozklad.png");
				toast.success("Картинку збережено");
			},
			() => {
				toast.error("Не вдалося зберегти картинку");
			},
		);
	};

	return (
		<div className="flex h-svh flex-col bg-card">
			<header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/70 bg-card px-3 py-1.5">
				<div className="flex min-w-0 items-center gap-1">
					{thisWeek !== undefined && (
						<Button
							variant="outline"
							size="compact"
							data-testid="current-week"
							disabled={week === thisWeek}
							onClick={() => setWeek(thisWeek)}
							className="mr-1 shrink-0"
						>
							Сьогодні
						</Button>
					)}
					<Button
						variant="ghost"
						size="icon-xs"
						data-testid="week-prev"
						aria-label="Попередній тиждень"
						disabled={previous === undefined}
						onClick={() => previous !== undefined && setWeek(previous)}
						className="text-muted-foreground"
					>
						<ChevronLeft />
					</Button>
					<Button
						variant="ghost"
						size="icon-xs"
						data-testid="week-next"
						aria-label="Наступний тиждень"
						disabled={next === undefined}
						onClick={() => next !== undefined && setWeek(next)}
						className="text-muted-foreground"
					>
						<ChevronRight />
					</Button>
					<h1 className="ml-1 flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
						<span
							className="min-w-0 truncate text-sm font-semibold text-foreground"
							data-testid="shared-title"
						>
							Розклад {shared.owner}, {shared.semesterName}
						</span>
						{planner.span && (
							<span
								className="shrink-0 text-xs text-muted-foreground"
								data-testid="week-dates"
							>
								{formatSpan(planner.span.start, planner.span.end)}
							</span>
						)}
					</h1>
				</div>
				<div className="ml-auto flex shrink-0 items-center gap-2 max-md:grid max-md:w-full max-md:grid-cols-2">
					{/* The planner's own switch: the current mode reads as pressed, not
              as a button that stopped working. */}
					<ToggleGroup
						type="single"
						value={week === undefined ? "all" : "week"}
						onValueChange={(value) => {
							if (value === "all") setWeek(undefined);
							else if (value === "week") setWeek(thisWeek ?? weeks[0]);
						}}
						aria-label="Семестр чи тиждень"
						spacing={1}
						className={`${SEGMENTED} max-md:col-span-2 max-md:w-full`}
					>
						<ToggleGroupItem
							value="all"
							data-testid="shared-week-all"
							className={`${SEGMENT} max-md:flex-1`}
						>
							Весь семестр
						</ToggleGroupItem>
						<ToggleGroupItem
							value="week"
							data-testid="shared-week-one"
							className={`${SEGMENT} max-md:flex-1`}
							disabled={weeks.length === 0}
						>
							По тижнях
						</ToggleGroupItem>
					</ToggleGroup>
					<Button
						variant="outline"
						size="compact"
						data-testid="shared-copy-text"
						onClick={() => void copyText()}
					>
						Скопіювати текстом
					</Button>
					<Button
						variant="outline"
						size="compact"
						data-testid="shared-copy-png"
						onClick={() => void copyPng()}
					>
						Картинка сітки
					</Button>
				</div>
			</header>
			<div className="min-h-0 flex-1" data-testid="shared-calendar">
				<PlannerCalendar
					planner={planner}
					onChoose={() => {}}
					readOnly
					gridRef={exports.gridRef}
					phoneRef={exports.phoneRef}
				/>
			</div>
			<footer className="shrink-0 border-t border-border/70 px-4 py-2 text-center text-xs text-muted-foreground">
				Це копія розкладу лише для перегляду. Зміни в плані власника тут не
				оновляться самі.
			</footer>
		</div>
	);
}
