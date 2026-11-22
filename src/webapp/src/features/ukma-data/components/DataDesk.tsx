import { useEffect, useRef } from "react";

import { DataProgress } from "./DataBits";

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
			<DataProgress value={progress} />
		</div>
	);
}

export type DeskKeys = Partial<
	Record<"1" | "2" | "ArrowRight" | "ArrowLeft" | "Escape", () => void>
>;

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
