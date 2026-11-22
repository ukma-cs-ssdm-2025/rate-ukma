import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { formatCount } from "../syncFormat";
import { Kbd, SyncProgress } from "./SyncBits";

export function DeskHead({
	title,
	progress,
	label,
}: Readonly<{ title: string; progress: number; label: string }>) {
	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
				<span className="text-sm text-muted-foreground tabular-nums">
					{label}
				</span>
			</div>
			<SyncProgress value={progress} />
		</div>
	);
}

export function LaterButton({ onLater }: Readonly<{ onLater: () => void }>) {
	return (
		<Button variant="ghost" size="lg" onClick={onLater} className="sm:ml-auto">
			Вирішу пізніше <Kbd>→</Kbd>
		</Button>
	);
}

export function DecisionsBar({
	count,
	onApply,
}: Readonly<{ count: number; onApply: () => void }>) {
	return (
		<div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-sm text-muted-foreground">
				{count === 0
					? "Ваших рішень поки немає. Вони зберігаються одразу, а на сайті змінюються, коли ви їх застосуєте."
					: `Ваших рішень: ${formatCount(count)}. Вони збережені; на сайті зміняться, коли ви їх застосуєте.`}
			</p>
			<Button
				variant={count === 0 ? "outline" : "default"}
				disabled={count === 0}
				onClick={onApply}
			>
				{count === 0
					? "Застосувати рішення"
					: `Застосувати рішення (${formatCount(count)})`}
			</Button>
		</div>
	);
}

export type DeskKeys = Partial<Record<"1" | "2" | "ArrowRight", () => void>>;

const typing = (target: EventTarget | null): boolean =>
	target instanceof HTMLElement &&
	(target.isContentEditable ||
		["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export function useDeskKeys(keys: DeskKeys, enabled: boolean) {
	const current = useRef(keys);
	useEffect(() => {
		current.current = keys;
	}, [keys]);
	useEffect(() => {
		if (!enabled) {
			return undefined;
		}
		const onKey = (event: KeyboardEvent) => {
			if (
				event.metaKey ||
				event.ctrlKey ||
				event.altKey ||
				typing(event.target) ||
				document.querySelector("[role=dialog]") !== null
			) {
				return;
			}
			const handler = Object.entries(current.current).find(
				([key]) => key === event.key,
			)?.[1];
			if (handler !== undefined) {
				event.preventDefault();
				handler();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [enabled]);
}
