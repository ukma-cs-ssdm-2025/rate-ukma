import { useCallback, useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ExpandableTextProps {
	readonly children: string;
	readonly className?: string;
}

export function ExpandableText({ children, className }: ExpandableTextProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [isClamped, setIsClamped] = useState(false);
	const textId = useId();
	const elRef = useRef<HTMLParagraphElement | null>(null);

	const measureRef = useCallback((el: HTMLParagraphElement | null) => {
		elRef.current = el;
		if (el) setIsClamped(el.scrollHeight > el.clientHeight);
	}, []);

	useEffect(() => {
		const el = elRef.current;
		if (el) {
			setIsClamped(el.scrollHeight > el.clientHeight);
			setIsExpanded(false);
		}
	}, [children]);

	return (
		<div>
			<p
				ref={measureRef}
				id={textId}
				className={cn(!isExpanded && "line-clamp-4", className)}
			>
				{children}
			</p>
			{isClamped && (
				<button
					type="button"
					onClick={() => setIsExpanded((v) => !v)}
					aria-expanded={isExpanded}
					aria-controls={textId}
					className="mt-1.5 rounded-full bg-muted px-3 py-0.5 text-sm text-muted-foreground hover:bg-muted/80 transition-colors"
				>
					{isExpanded ? "Згорнути" : "Читати далі"}
				</button>
			)}
		</div>
	);
}
