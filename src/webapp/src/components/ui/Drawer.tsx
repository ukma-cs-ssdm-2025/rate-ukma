import { useCallback, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

interface DrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: React.ReactNode;
	ariaLabel: string;
	closeButtonLabel: string;
	"data-testid"?: string;
}

const TRANSITION_DURATION_MS = 300;

export function Drawer({
	open,
	onOpenChange,
	children,
	ariaLabel,
	closeButtonLabel,
	"data-testid": testId,
}: Readonly<DrawerProps>) {
	const [isMounted, setIsMounted] = useState(open);
	const [shouldSlideIn, setShouldSlideIn] = useState(open);

	useEffect(() => {
		if (open) {
			setIsMounted(true);
			return;
		}

		const timer = globalThis.window.setTimeout(
			() => setIsMounted(false),
			TRANSITION_DURATION_MS,
		);
		return () => globalThis.window.clearTimeout(timer);
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
		<dialog
			open
			className="fixed inset-0 z-[9999] m-0 h-full w-full overflow-hidden"
			onClose={(event) => {
				event.preventDefault();
				close();
			}}
			aria-modal="true"
			aria-label={ariaLabel}
			data-testid={testId}
		>
			<button
				type="button"
				className={cn(
					"fixed inset-0 z-0 bg-background/80 backdrop-blur transition-opacity",
					open ? "opacity-100" : "opacity-0 pointer-events-none",
				)}
				style={{ transitionDuration: `${TRANSITION_DURATION_MS}ms` }}
				onClick={close}
				aria-label={closeButtonLabel}
			/>
			<aside
				className={cn(
					"fixed right-0 top-0 h-full z-10 w-full max-w-sm flex flex-col gap-6 overflow-y-auto rounded-tl-[32px] rounded-bl-0 bg-popover/95 p-6 pb-6 shadow-[0_20px_45px_rgba(15,23,42,0.35)] backdrop-blur-sm",
				)}
				style={{
					transition: `transform ${TRANSITION_DURATION_MS}ms ease, opacity ${TRANSITION_DURATION_MS}ms ease`,
					transform: shouldSlideIn ? "translateX(0)" : "translateX(100%)",
					opacity: shouldSlideIn ? 1 : 0,
				}}
			>
				{children}
			</aside>
		</dialog>
	);
}
