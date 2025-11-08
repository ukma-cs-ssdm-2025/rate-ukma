import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface DrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
	overlayClassName?: string;
	panelClassName?: string;
	wrapperClassName?: string;
}

const TRANSITION_DURATION_MS = 300;

export function Drawer({
	open,
	onOpenChange,
	children,
	overlayClassName,
	panelClassName,
	wrapperClassName = "flex md:hidden",
}: DrawerProps) {
	const [isMounted, setIsMounted] = useState(open);
	const [shouldSlideIn, setShouldSlideIn] = useState(open);

	useEffect(() => {
		if (open) {
			setIsMounted(true);
			return;
		}

		if (typeof window === "undefined") {
			setIsMounted(false);
			return;
		}

		const timer = window.setTimeout(
			() => setIsMounted(false),
			TRANSITION_DURATION_MS,
		);
		return () => window.clearTimeout(timer);
	}, [open]);

	const close = useCallback(() => onOpenChange(false), [onOpenChange]);

	useEffect(() => {
		if (!open) {
			document.body.style.overflow = "";
			setShouldSlideIn(false);
			return;
		}

		document.body.style.overflow = "hidden";

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				close();
			}
		};

		const frame = requestAnimationFrame(() => setShouldSlideIn(true));

		document.addEventListener("keydown", handleEscape);
		return () => {
			document.body.style.overflow = "";
			cancelAnimationFrame(frame);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [open, close]);

	if (!isMounted) {
		return null;
	}

	return (
		<div
			className={`fixed inset-0 z-50 ${wrapperClassName}`}
			role="dialog"
			aria-modal="true"
		>
			<button
				type="button"
				className={cn(
					"absolute inset-0 bg-background/80 backdrop-blur transition-opacity",
					overlayClassName,
					open ? "opacity-100" : "opacity-0 pointer-events-none",
				)}
				style={{ transitionDuration: `${TRANSITION_DURATION_MS}ms` }}
				onClick={close}
			/>
			<aside
				className={cn(
					"relative z-10 ml-auto flex h-full w-full max-w-xs flex-col gap-6 overflow-y-auto rounded-tl-[32px] rounded-bl-0 bg-popover/95 p-6 pb-6 shadow-[0_20px_45px_rgba(15,23,42,0.35)] backdrop-blur-sm",
					panelClassName,
				)}
				style={{
					transition: `transform ${TRANSITION_DURATION_MS}ms ease, opacity ${TRANSITION_DURATION_MS}ms ease`,
					transform: shouldSlideIn ? "translateX(0)" : "translateX(100%)",
					opacity: shouldSlideIn ? 1 : 0,
				}}
			>
				{children}
			</aside>
		</div>
	);
}
