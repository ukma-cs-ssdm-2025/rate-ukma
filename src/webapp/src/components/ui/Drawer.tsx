import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { cn } from "@/lib/utils";

interface DrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
	ariaLabel: string;
	/** `bottom` rises as a sheet; use it for panels opened from a bottom control. */
	side?: "right" | "bottom";
	/** Kept for callers; the scrim is no longer a labelled button. */
	closeButtonLabel?: string;
	"data-testid"?: string;
}

// Matches the exit transition below, so the panel unmounts after it has left.
const EXIT_DURATION_MS = 220;

const HIDDEN_OFFSET = {
	right: "translate-x-full",
	bottom: "translate-y-full",
} as const;

export function Drawer({
	open,
	onOpenChange,
	children,
	ariaLabel,
	side = "right",
	"data-testid": testId,
}: Readonly<DrawerProps>) {
	const [isMounted, setIsMounted] = useState(open);
	const [isShown, setIsShown] = useState(false);

	useEffect(() => {
		if (open) {
			setIsMounted(true);
			return;
		}

		setIsShown(false);
		const timer = globalThis.window.setTimeout(
			() => setIsMounted(false),
			EXIT_DURATION_MS,
		);
		return () => globalThis.window.clearTimeout(timer);
	}, [open]);

	// The panel must paint once off-screen before it can transition in, so the
	// flip waits two frames after mount.
	useEffect(() => {
		if (!open || !isMounted) return;
		let frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => setIsShown(true));
		});
		return () => cancelAnimationFrame(frame);
	}, [open, isMounted]);

	// Unlocking only after unmount keeps the page from jumping mid-exit.
	useEffect(() => {
		if (!isMounted) return;
		return lockBodyScroll();
	}, [isMounted]);

	const close = useCallback(() => onOpenChange(false), [onOpenChange]);

	if (!isMounted) {
		return null;
	}

	const motion = isShown
		? "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
		: "duration-200 ease-in";

	// Portaled to body: an ancestor stacking context (e.g. a view-transition
	// name on /explore) would otherwise trap it under the sticky header.
	return createPortal(
		<dialog
			open
			aria-modal="true"
			aria-label={ariaLabel}
			className="fixed inset-0 z-50 m-0 h-full w-full overflow-hidden border-none bg-transparent p-0 backdrop:bg-transparent"
			data-testid={testId}
		>
			<div
				className={cn(
					"fixed inset-0 z-0 bg-background/80 backdrop-blur transition-opacity motion-reduce:transition-none",
					motion,
					isShown ? "opacity-100" : "pointer-events-none opacity-0",
				)}
				onClick={close}
				aria-hidden="true"
			/>
			<aside
				className={cn(
					"fixed z-10 flex flex-col bg-card text-card-foreground shadow-xl transition-transform will-change-transform motion-reduce:transition-none",
					motion,
					side === "right"
						? "top-0 right-0 h-full w-full max-w-sm gap-6 overflow-y-auto rounded-l-xl p-6"
						: "inset-x-0 bottom-0 max-h-[85dvh] gap-4 overflow-hidden rounded-t-2xl border-t border-border px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]",
					isShown ? "translate-x-0 translate-y-0" : HIDDEN_OFFSET[side],
				)}
			>
				{side === "bottom" && (
					<div
						className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
						aria-hidden="true"
					/>
				)}
				{children}
			</aside>
		</dialog>,
		document.body,
	);
}
