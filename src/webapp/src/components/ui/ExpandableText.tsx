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

// Tailwind only generates static line-clamp utilities, so a custom count
// uses the equivalent inline properties; the default keeps line-clamp-4.
const collapsedStyle =
	!isExpanded && lines !== 4
		? {
				display: "-webkit-box",
				WebkitBoxOrient: "vertical",
				WebkitLineClamp: lines,
				overflow: "hidden",
			} as const
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
					onClick={() => setIsExpanded((v) => !v)}
					aria-expanded={isExpanded}
					aria-controls={textId}
					className="mt-1.5 text-sm text-primary hover:underline"
				>
					{isExpanded ? "Згорнути" : "Читати далі"}
				</button>
			)}
		</div>
	);
}
