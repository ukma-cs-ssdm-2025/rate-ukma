import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ExpandableTextProps {
	readonly children: string;
	readonly className?: string;
	/** Collapsed line-clamp; applied only when collapsed. Defaults to 4. */
	readonly lines?: number;
}

export function ExpandableText({
	children,
	className,
	lines = 4,
}: ExpandableTextProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [isClamped, setIsClamped] = useState(false);
	const textId = useId();
	const elRef = useRef<HTMLParagraphElement | null>(null);
	const heightBeforeToggle = useRef<number | null>(null);

	const measureRef = useCallback((el: HTMLParagraphElement | null) => {
		elRef.current = el;
		if (el) setIsClamped(el.scrollHeight > el.clientHeight);
	}, []);

	// When content changes, collapse so the clamped layout is applied before measuring.
	// children is a prop that signals new content
	useLayoutEffect(() => {
		setIsExpanded(false);
	}, [children]);

	// Remeasure clamping after every transition back to the collapsed state.
	// children is a prop that signals new content
	useLayoutEffect(() => {
		if (isExpanded) return;
		const el = elRef.current;
		if (el) setIsClamped(el.scrollHeight > el.clientHeight);
	}, [isExpanded, children, lines]);

	// Clamping snaps the text instantly, so the height glides between the two
	// measured states instead.
	useLayoutEffect(() => {
		const el = elRef.current;
		const from = heightBeforeToggle.current;
		heightBeforeToggle.current = null;
		if (!el || from == null) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
		const to = el.getBoundingClientRect().height;
		if (from === to) return;
		el.animate(
			[
				{ height: `${from}px`, overflow: "hidden" },
				{ height: `${to}px`, overflow: "hidden" },
			],
			{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" },
		);
	}, [isExpanded]);

	// Tailwind only generates static line-clamp utilities, so a custom count
	// uses the equivalent inline properties; the default keeps line-clamp-4.
	const collapsedStyle =
		!isExpanded && lines !== 4
			? ({
					display: "-webkit-box",
					WebkitBoxOrient: "vertical",
					WebkitLineClamp: lines,
					overflow: "hidden",
				} as const)
			: undefined;

	return (
		<div>
			<p
				ref={measureRef}
				id={textId}
				style={collapsedStyle}
				className={cn(!isExpanded && lines === 4 && "line-clamp-4", className)}
			>
				{children}
			</p>
			{isClamped && (
				<button
					type="button"
					onClick={() => {
						heightBeforeToggle.current =
							elRef.current?.getBoundingClientRect().height ?? null;
						setIsExpanded((v) => !v);
					}}
					aria-expanded={isExpanded}
					aria-controls={textId}
					className="mt-1.5 text-sm text-primary underline-offset-4 hover:underline"
				>
					{isExpanded ? "Згорнути" : "Читати далі"}
				</button>
			)}
		</div>
	);
}
