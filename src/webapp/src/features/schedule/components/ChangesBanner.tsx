import type { LessonChange, LessonRow, Week } from "@/features/schedule/core";
import { groupOf, placeOf } from "@/features/schedule/core";
import { History } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import type { LessonChangesView } from "@/features/schedule/hooks/useLessonChanges";
import { absoluteTime, plural } from "@/features/schedule/lib/format";
import {
	touchesWeek,
	weeksLabel,
	whenOf,
} from "@/features/schedule/lib/lesson-changes";
import { displayShort } from "@/features/schedule/lib/names";
import { telemetry } from "@/features/schedule/lib/telemetry";

interface Props {
	view: LessonChangesView;
	week: Week | undefined;
	names: ReadonlyMap<string, string>;
	labels: ReadonlyMap<string, string>;
}

const CHANGES = ["зміна", "зміни", "змін"] as const;

const weekLine = (
	changes: ReadonlyArray<LessonChange>,
	week: Week | undefined,
) => {
	if (week === undefined) {
		return changes.length === 1
			? "Вона підсвічена на сітці."
			: "Вони підсвічені на сітці.";
	}
	const here = changes.filter((change) => touchesWeek(change, week)).length;
	if (here === 0) return "Цього тижня їх немає.";
	return `Цього тижня ${here}, ${here === 1 ? "вона підсвічена" : "вони підсвічені"}.`;
};

/**
 * One line over the grid when the faculty changed the student's own lessons
 * since they last looked: how many, how many this week, the list, and
 * «Зрозуміло», which clears the line and the marks on the grid.
 */
export function ChangesBanner(props: Props) {
	const { view, week, names, labels } = props;
	const [open, setOpen] = useState(false);
	// «Зрозуміло» lets the line slide away before it unmounts.
	const [leaving, setLeaving] = useState(false);
	const isMobile = useIsMobile();
	const { changes, dismiss } = view;
	if (changes.length === 0) return null;
	const openList = () => {
		telemetry.track("changes_opened", { count: changes.length });
		setOpen(true);
	};
	return (
		<div
			data-testid="changes-banner"
			role="status"
			className={`flex shrink-0 items-center gap-x-3 gap-y-1 border-b border-l-[3px] border-border/70 border-l-primary bg-card px-3 py-1.5 text-xs max-md:pr-1 ${leaving ? "animate-out fade-out-0 slide-out-to-top-1 fill-mode-forwards duration-150 ease-in-quad" : "animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-out-quint"}`}
			onAnimationEnd={(event) => {
				if (!leaving || event.target !== event.currentTarget) return;
				setLeaving(false);
				dismiss();
			}}
		>
			<History
				className="size-4 shrink-0 text-primary max-md:hidden"
				aria-hidden
			/>
			<p className="min-w-0 flex-1 text-foreground">
				{isMobile ? (
					<>
						<span className="font-semibold">
							{plural(changes.length, CHANGES)} у твоїх парах
						</span>{" "}
						<span className="text-muted-foreground">з останнього візиту</span>
					</>
				) : (
					<>
						<span className="font-semibold">
							З твого останнього візиту {plural(changes.length, CHANGES)} у
							твоїх парах.
						</span>{" "}
						<span className="text-muted-foreground">
							{weekLine(changes, week)}
						</span>
					</>
				)}
			</p>
			<Button
				variant={isMobile ? "ghost" : "outline"}
				size="xs"
				data-testid="changes-open"
				onClick={openList}
				className={isMobile ? "text-primary" : ""}
			>
				Що саме
			</Button>
			{!isMobile && (
				<Button
					variant="ghost"
					size="xs"
					data-testid="changes-dismiss"
					onClick={() => setLeaving(true)}
					className="text-primary"
				>
					Зрозуміло
				</Button>
			)}
			<ChangesDialog
				open={open}
				onOpenChange={setOpen}
				view={view}
				names={names}
				labels={labels}
			/>
		</div>
	);
}

const KIND = {
	moved: { label: "перенесено", variant: "warning" },
	room: { label: "нова аудиторія", variant: "warning" },
	cancelled: { label: "скасовано", variant: "destructive" },
	added: { label: "додано", variant: "success" },
} as const;

const placeText = (row: LessonRow): string =>
	placeOf(row) ?? "місце не вказано";

const Was = ({ children }: { children: React.ReactNode }) => (
	<s className="text-muted-foreground decoration-muted-foreground/60">
		{children}
	</s>
);
const Now = ({ children }: { children: React.ReactNode }) => (
	<span className="font-semibold text-foreground">{children}</span>
);
const Arrow = () => <span className="mx-1.5 text-muted-foreground">→</span>;

/** «було → стало» for one change, in the words of its kind. */
function ChangeDetail({ change }: { change: LessonChange }) {
	const { before, after } = change;
	if (change.kind === "moved" && before && after) {
		const sameWeeks = weeksLabel(before.weeks) === weeksLabel(after.weeks);
		return (
			<>
				<Was>{whenOf(before)}</Was>
				<Arrow />
				<Now>{whenOf(after)}</Now>
				{sameWeeks ? (
					<span className="text-muted-foreground">
						, {weeksLabel(after.weeks)}
					</span>
				) : (
					<>
						{", "}
						<Was>{weeksLabel(before.weeks)}</Was>
						<Arrow />
						<Now>{weeksLabel(after.weeks)}</Now>
					</>
				)}
			</>
		);
	}
	if (change.kind === "room" && before && after) {
		return (
			<>
				{whenOf(after)}: <Was>{placeText(before)}</Was>
				<Arrow />
				<Now>{placeText(after)}</Now>
			</>
		);
	}
	if (change.kind === "cancelled" && before) {
		return after ? (
			<>
				{whenOf(before)}, <Now>{weeksLabel(change.weeks)}</Now>{" "}
				<span className="text-muted-foreground">(інші тижні як були)</span>
			</>
		) : (
			<>
				<Was>
					{whenOf(before)}, {weeksLabel(before.weeks)}
				</Was>{" "}
				<span className="text-muted-foreground">
					(у файлі цієї пари більше немає)
				</span>
			</>
		);
	}
	if (change.kind === "added" && after) {
		return before ? (
			<>
				{whenOf(after)}, <Now>{weeksLabel(change.weeks)}</Now>{" "}
				<span className="text-muted-foreground">(до тижнів, що були)</span>
			</>
		) : (
			<>
				<Now>
					{whenOf(after)}, {weeksLabel(after.weeks)}
				</Now>
				<span className="text-muted-foreground">, {placeText(after)}</span>
			</>
		);
	}
	return null;
}

/** Every change since the last visit as «було → стало», with «Зрозуміло»,
 *  which marks them seen like the line over the grid does. */
function ChangesDialog(props: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	view: LessonChangesView;
	names: ReadonlyMap<string, string>;
	labels: ReadonlyMap<string, string>;
}) {
	const { open, onOpenChange, view, names, labels } = props;
	const nameOf = (row: LessonRow) =>
		labels.get(row.disciplineId) ??
		displayShort(names, row.disciplineId, row.discipline);
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-lg" data-testid="changes-dialog">
				<DialogHeader>
					<DialogTitle>Що змінилося в розкладі</DialogTitle>
					<DialogDescription>
						У твоїх парах з останнього візиту
						{view.toAt === null
							? ""
							: `, файли станом на ${absoluteTime(view.toAt)}`}
						.
					</DialogDescription>
				</DialogHeader>
				<ul className="-mx-1 flex max-h-[55vh] flex-col overflow-y-auto px-1">
					{view.changes.map((change, index) => {
						const row = change.after ?? change.before;
						if (!row) return null;
						return (
							<li
								key={index}
								data-testid="change-item"
								data-kind={change.kind}
								className="border-t border-border/60 py-2.5 first:border-t-0 first:pt-0"
							>
								<p className="flex flex-wrap items-center gap-x-1.5 text-sm">
									<span className="font-semibold text-foreground">
										{nameOf(row)}, {groupOf(row)}
									</span>
									<Badge variant={KIND[change.kind].variant}>
										{KIND[change.kind].label}
									</Badge>
								</p>
								<p className="mt-1 text-xs text-foreground">
									<ChangeDetail change={change} />
								</p>
								{change.corrected && (
									<p className="mt-0.5 text-meta text-muted-foreground">
										У тебе цю пару виправлено вручну, на сітці лишається твоя
										версія.
									</p>
								)}
							</li>
						);
					})}
				</ul>
				<DialogFooter>
					<Button
						size="compact"
						data-testid="changes-dialog-dismiss"
						onClick={() => {
							onOpenChange(false);
							view.dismiss();
						}}
					>
						Зрозуміло
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
