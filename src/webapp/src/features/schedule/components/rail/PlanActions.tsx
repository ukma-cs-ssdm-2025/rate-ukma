import type {
	DisciplineId,
	Offering,
	Selection,
} from "@/features/schedule/core";
import {
	Check,
	Copy,
	Ellipsis,
	Eraser,
	EyeOff,
	Link2,
	Lock,
	Pencil,
	RotateCcw,
	TriangleAlert,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ShareDialog } from "@/features/schedule/components/ShareDialog";
import {
	CalendarCard,
	type CalendarLink,
} from "@/features/schedule/components/rail/CalendarCard";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { plural, wordFor } from "@/features/schedule/lib/format";
import { undoable } from "@/features/schedule/lib/undo";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import {
	copyTextSilent,
	toastCopyFailed,
} from "@/features/schedule/lib/clipboard";
import { displayShort } from "@/features/schedule/lib/names";
import { usePlanDraft } from "@/features/schedule/stores/plan";

interface Props {
	locked: boolean;
	picked: ReadonlyArray<DisciplineId>;
	offerings: ReadonlyArray<Offering>;
	selection: Selection;
	names: ReadonlyMap<string, string>;
	chosenCount: number;
	/** Disciplines that have a group to choose. */
	selectableCount: number;
	chosenAny: boolean;
	hasRegistered?: boolean;
	/** The semester the share link is minted for; undefined means current. */
	semesterName: string | undefined;
	/** Restore the plan to exactly what САЗ has on record. */
	resetToSaz: () => void;
	/** Every discipline with a choice has one: the plan can be called final. */
	complete: boolean;
	/** How many disciplines still lack a group. */
	remaining: number;
	lockPlan: () => void;
	unlockPlan: () => void;
	/** Disciplines whose stream the picker was unsure about. */
	unsureStreams: number;
	/** The feed to subscribe to; offered once every group is chosen. */
	calendar?: CalendarLink | undefined;
}

/**
 * The plan card at the top of the rail: how far the plan is, the one step
 * that finishes it, and the ways to hand it over. Rare plan-wide resets sit
 * behind «⋯» with what they do written out, and both can be taken back.
 * Locked, the card says so and keeps the way back next to the hand-overs.
 */
export function PlanActions(props: Props) {
	const {
		locked,
		picked,
		offerings,
		selection,
		names,
		chosenCount,
		selectableCount,
		chosenAny,
		hasRegistered,
		semesterName,
		resetToSaz,
		complete,
		remaining,
		lockPlan,
		unlockPlan,
		unsureStreams,
		calendar,
	} = props;
	const { updateSelection, hidden } = usePlanDraft();
	// A hidden discipline is one the student does not attend (a course already
	// passed on mobility, say): its groups leave the count, and the card says so.
	const hiddenCount = picked.filter((id) => hidden.includes(id)).length;
	const allHidden = hiddenCount === picked.length;
	const [sharing, setSharing] = useState(false);
	const shareDialog = (
		<ShareDialog
			open={sharing}
			onOpenChange={setSharing}
			semester={semesterName}
			canShare={picked.length > 0}
		/>
	);

	if (locked) {
		return (
			<section className={CARD} data-testid="plan-locked">
				<div className="flex items-center gap-2.5">
					<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/14 text-success">
						<Lock className="size-4" />
					</span>
					<div className="min-w-0">
						<h2 className="text-sm font-semibold text-foreground">
							Розклад зафіксовано
						</h2>
						<p className="text-xs text-muted-foreground">
							Сітка показує лише твої групи
						</p>
					</div>
				</div>
				{/* Where the lock button stood, so the way back is where the way in was. */}
				<Button
					variant="outline"
					size="compact"
					data-testid="unlock-plan"
					onClick={unlockPlan}
					className="mt-3 w-full"
				>
					<Pencil /> Редагувати
				</Button>
				<div className="mt-1.5 grid grid-cols-2 gap-1.5">
					<ShareButton
						disabled={picked.length === 0}
						onOpen={() => setSharing(true)}
					/>
					<CopyGroups
						offerings={offerings}
						selection={selection}
						names={names}
						disabled={chosenCount === 0}
					/>
				</div>
				{calendar && <CalendarSection calendar={calendar} />}
				{shareDialog}
			</section>
		);
	}

	if (picked.length === 0) {
		return (
			<section className={CARD} data-testid="plan-actions">
				<h2 className="text-sm font-semibold text-foreground">Твій план</h2>
				<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
					Додай дисципліни, і тут з’явиться, скільки груп лишилось обрати.
				</p>
				<ShareButton
					disabled
					onOpen={() => setSharing(true)}
					className="mt-3"
				/>
				{shareDialog}
			</section>
		);
	}

	const chosenFraction =
		selectableCount === 0 ? 1 : chosenCount / selectableCount;
	return (
		<section className={CARD} data-testid="plan-actions">
			<div className="flex items-baseline justify-between gap-2">
				<h2 className="text-sm font-semibold text-foreground">Твій план</h2>
				{selectableCount > 0 && (
					<span className="text-xs text-muted-foreground tabular-nums">
						{chosenCount} з {plural(selectableCount, ["групи", "груп", "груп"])}
					</span>
				)}
			</div>
			{selectableCount > 0 && (
				<div
					className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
					role="progressbar"
					aria-label="Обрано груп"
					aria-valuemin={0}
					aria-valuemax={selectableCount}
					aria-valuenow={chosenCount}
				>
					<div
						className="h-full rounded-full bg-primary transition-[width] duration-300"
						style={{ width: `${Math.round(chosenFraction * 100)}%` }}
					/>
				</div>
			)}
			{chosenCount < selectableCount ? (
				<p
					className="mt-1.5 text-xs text-muted-foreground"
					data-testid="plan-progress"
				>
					лишилось обрати{" "}
					{plural(selectableCount - chosenCount, ["групу", "групи", "груп"])}
				</p>
			) : unsureStreams > 0 ? (
				<p className="mt-1.5 flex items-center gap-1 text-xs text-warning">
					<TriangleAlert className="size-3.5 shrink-0" />
					{unsureStreams}{" "}
					{wordFor(unsureStreams, ["потік", "потоки", "потоків"])} з жовтою
					позначкою варто перевірити
				</p>
			) : allHidden ? (
				<p className="mt-1.5 text-xs text-muted-foreground">
					Усі дисципліни сховано, обирати нічого
				</p>
			) : (
				<p className="mt-1.5 flex items-center gap-1 text-xs text-foreground">
					<Check className="size-3.5 shrink-0 text-primary" /> Усі групи обрано
				</p>
			)}
			{hiddenCount > 0 && !allHidden && (
				<p
					className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
					data-testid="plan-hidden"
				>
					<EyeOff className="size-3.5 shrink-0" />
					{plural(hiddenCount, [
						"сховану дисципліну",
						"сховані дисципліни",
						"схованих дисциплін",
					])}{" "}
					не рахуємо
				</p>
			)}
			<Explained
				className="mt-3 w-full"
				hint={
					allHidden
						? "Покажи хоча б одну дисципліну, щоб було що фіксувати."
						: !complete
							? `Стане доступним, коли в кожній дисципліні буде обрано групу. Лишилось ${remaining}.`
							: unsureStreams > 0
								? `${unsureStreams} ${wordFor(unsureStreams, ["потік", "потоки", "потоків"])} з жовтою позначкою варто перевірити перед фіксацією.`
								: "Сітка покаже лише твої групи, без випадкових кліків. Повернутись до редагування можна будь-коли."
				}
			>
				<Button
					size="compact"
					data-testid="lock-plan"
					aria-disabled={!complete}
					onClick={complete ? lockPlan : undefined}
					className="w-full"
				>
					<Lock /> Зафіксувати розклад
				</Button>
			</Explained>
			<div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1.5">
				<ShareButton
					disabled={picked.length === 0}
					onOpen={() => setSharing(true)}
				/>
				<CopyGroups
					offerings={offerings}
					selection={selection}
					names={names}
					disabled={chosenCount === 0}
				/>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="outline"
							size="icon-sm"
							aria-label="Інші дії з планом"
							data-testid="plan-more"
							className="pointer-coarse:size-11"
						>
							<Ellipsis />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="w-64">
						<DropdownMenuItem
							data-testid="reset-to-saz"
							disabled={!hasRegistered}
							onSelect={() => undoable("План узято з САЗ", resetToSaz)}
							className="items-start"
						>
							<RotateCcw className="mt-0.5" />
							<span className="flex flex-col">
								Взяти дисципліни й групи з САЗ
								<span className="text-meta text-muted-foreground">
									{hasRegistered
										? "Як у твоїх записах. Вибір тут заміниться."
										: "У САЗ поки немає твоїх записів на цей семестр."}
								</span>
							</span>
						</DropdownMenuItem>
						<DropdownMenuItem
							data-testid="clear-selection"
							disabled={!chosenAny}
							onSelect={() =>
								undoable("Вибір груп знято", () => updateSelection(() => ({})))
							}
							className="items-start"
						>
							<Eraser className="mt-0.5" />
							<span className="flex flex-col">
								Зняти вибір у всіх дисциплінах
								<span className="text-meta text-muted-foreground">
									Дисципліни лишаться, групи обереш наново.
								</span>
							</span>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			{calendar && complete && <CalendarSection calendar={calendar} />}
			{shareDialog}
		</section>
	);
}

/** The calendar offer under a hairline that spans the card. */
const CalendarSection = ({ calendar }: { calendar: CalendarLink }) => (
	<div className="-mx-3 mt-3 border-t border-sidebar-border px-3 pt-3">
		<CalendarCard calendar={calendar} />
	</div>
);

/** The plan card's frame: a white surface on the tinted rail. */
const CARD = "rounded-xl border border-sidebar-border bg-card p-3 shadow-xs";

/** A hover tooltip on desktops; phones have no hover, so the label and the
 *  card's progress line carry the button there. The buttons it wraps say
 *  `aria-disabled`, not `disabled`, so a keyboard still reaches them and
 *  the hint that explains why. */
function Explained({
	hint,
	className = "",
	children,
}: {
	hint: string;
	className?: string;
	children: React.ReactNode;
}) {
	const isMobile = useIsMobile();
	if (isMobile) return <div className={className}>{children}</div>;
	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<span className={`inline-flex ${className}`}>{children}</span>
			</TooltipTrigger>
			<TooltipContent className="max-w-56">{hint}</TooltipContent>
		</Tooltip>
	);
}

/** The way into the read-only link dialog, next to the other plan outputs. */
function ShareButton(props: {
	disabled: boolean;
	onOpen: () => void;
	className?: string;
}) {
	const { disabled, onOpen, className = "" } = props;
	return (
		<Button
			variant="outline"
			size="compact"
			data-testid="share-plan"
			disabled={disabled}
			onClick={onOpen}
			className={`min-w-0 ${className}`}
		>
			<Link2 /> <span className="truncate">Поділитися</span>
		</Button>
	);
}

/** Every decision made: hand the result over as text, ready for САЗ day. */
function CopyGroups(props: {
	offerings: ReadonlyArray<Offering>;
	selection: Selection;
	names: ReadonlyMap<string, string>;
	disabled: boolean;
	className?: string;
}) {
	const { offerings, selection, names, disabled, className = "" } = props;

	const [copied, setCopied] = useState(false);
	const timer = useRef<number | undefined>(undefined);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	const copy = async () => {
		const lines: string[] = [];
		for (const offering of offerings) {
			const group = selection[offering.disciplineId];
			if (!group) continue;
			lines.push(
				`${displayShort(names, offering.disciplineId, offering.discipline)}: гр. ${group}`,
			);
		}
		if (await copyTextSilent(lines.join("\n"))) {
			setCopied(true);
			window.clearTimeout(timer.current);
			timer.current = window.setTimeout(() => setCopied(false), 1600);
		} else {
			toastCopyFailed();
		}
	};

	return (
		<Explained
			hint="Скопіювати список «дисципліна: група» з твого плану. Зручно тримати перед очима, коли записуєшся в САЗ."
			className={`min-w-0 ${className}`}
		>
			<Button
				variant="outline"
				size="compact"
				data-testid="copy-groups"
				aria-disabled={disabled}
				onClick={disabled ? undefined : () => void copy()}
				className="w-full min-w-0"
			>
				{copied ? <Check /> : <Copy />}{" "}
				<span className="truncate">
					{copied ? "Скопійовано" : "Скопіювати"}
				</span>
			</Button>
		</Explained>
	);
}
