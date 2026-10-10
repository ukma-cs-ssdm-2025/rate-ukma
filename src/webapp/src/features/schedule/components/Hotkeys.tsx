import type { Week } from "@/features/schedule/core";
import { useEffect } from "react";
import { Kbd } from "@/components/ui/Kbd";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { useSidebar } from "@/components/ui/Sidebar";
import { stepWeek } from "@/features/schedule/lib/weeks";
import { useUi } from "@/features/schedule/stores/ui";

interface Props {
	readonly weeks: ReadonlyArray<Week>;
	readonly thisWeek: Week | undefined;
	/** No view switching while the plan is locked. */
	readonly locked: boolean;
	readonly hasClashes: boolean;
	/** The «?» card; its owner opens it from a menu, the key opens it too. */
	readonly open: boolean;
	readonly onOpenChange: (open: boolean) => void;
}

export const KEYS: ReadonlyArray<readonly [string, string]> = [
	["1 … 9", "тиждень за номером"],
	["← →", "попередній / наступний тиждень"],
	["T", "сьогоднішній тиждень"],
	["0 або S", "весь семестр"],
	["C", "лише накладки, ще раз щоб усі"],
	["B", "показати або сховати дисципліни"],
	["Esc", "вийти з режиму однієї дисципліни"],
	["?", "ця підказка"],
];

/** Physical keys, so a Ukrainian layout types the same shortcuts. */
const DIGIT = /^Digit([1-9])$/u;

/** Typing in a field, a modifier held, or an open dialog, menu or list:
 *  the keys are theirs. The week toggle is not: after a click on it the
 *  arrows still walk the weeks. */
const claimed = (event: KeyboardEvent): boolean => {
	if (event.metaKey || event.ctrlKey || event.altKey) return true;
	const target = event.target;
	if (target instanceof HTMLElement) {
		if (target.isContentEditable) return true;
		const tag = target.tagName;
		if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
		if (target.closest("[role=menu],[role=listbox]")) return true;
	}
	return (
		document.querySelector(
			"[role=dialog][data-state=open],[role=menu][data-state=open],[role=listbox][data-state=open]",
		) !== null
	);
};

/** Single-key shortcuts for the grid, and the «?» card that lists them. */
export function Hotkeys({
	weeks,
	thisWeek,
	locked,
	hasClashes,
	open,
	onOpenChange,
}: Props) {
	const { toggleSidebar } = useSidebar();

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (
				(event.key === "?" || (event.shiftKey && event.code === "Slash")) &&
				!claimed(event)
			) {
				event.preventDefault();
				onOpenChange(!open);
				return;
			}
			if (claimed(event)) return;
			const ui = useUi.getState();
			const digit = DIGIT.exec(event.code)?.[1];
			if (digit !== undefined) {
				const wanted = weeks.find((week) => week === Number(digit));
				if (wanted === undefined) return;
				ui.setWeek(wanted);
				event.preventDefault();
				return;
			}
			switch (event.code) {
				case "ArrowLeft":
				case "ArrowRight": {
					const next = stepWeek(
						weeks,
						ui.week,
						event.code === "ArrowLeft" ? -1 : 1,
					);
					if (next !== undefined) ui.setWeek(next);
					break;
				}
				case "KeyT":
					if (thisWeek === undefined) break;
					ui.setWeek(thisWeek);
					ui.bumpToday();
					break;
				case "Digit0":
				case "KeyS":
					ui.setWeek(undefined);
					break;
				case "KeyC":
					if (locked) break;
					if (ui.view === "clashes") ui.setView("all");
					else if (hasClashes) ui.setView("clashes");
					break;
				case "KeyB":
					toggleSidebar();
					break;
				default:
					return;
			}
			event.preventDefault();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [weeks, thisWeek, locked, hasClashes, toggleSidebar, open, onOpenChange]);

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Клавіші</DialogTitle>
						<DialogDescription>
							Працюють, коли курсор не в полі вводу.
						</DialogDescription>
					</DialogHeader>
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
						{KEYS.map(([key, what]) => (
							<div key={key} className="contents">
								<dt>
									<Kbd className="tabular-nums text-xs text-foreground">
										{key}
									</Kbd>
								</dt>
								<dd className="text-muted-foreground">{what}</dd>
							</div>
						))}
					</dl>
				</DialogContent>
			</Dialog>
		</>
	);
}
