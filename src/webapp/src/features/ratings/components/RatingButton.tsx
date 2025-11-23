import * as React from "react";

import { Button } from "@/components/ui/Button";
import { CANNOT_RATE_TOOLTIP_TEXT } from "@/features/ratings/definitions/ratingDefinitions";

interface RatingButtonProps {
	canRate: boolean;
	onClick?: () => void;
	children: React.ReactNode;
	className?: string;
	size?: "sm" | "lg" | "default";
	asChild?: boolean;
}

export function RatingButton({
	canRate,
	onClick,
	children,
	className = "",
	size = "lg",
	asChild = false,
}: RatingButtonProps) {
	const [showTooltip, setShowTooltip] = React.useState(false);
	const tooltipId = React.useId();

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: wrapper div for tooltip positioning
		<div
			className={`relative ${size === "lg" ? "w-full max-w-md" : "inline-block"}`}
			onMouseEnter={() => !canRate && setShowTooltip(true)}
			onMouseLeave={() => setShowTooltip(false)}
		>
			<Button
				size={size}
				disabled={!canRate}
				onClick={canRate ? onClick : undefined}
				asChild={canRate ? asChild : false}
				aria-describedby={!canRate ? tooltipId : undefined}
				className={`${size === "lg" ? "w-full" : ""} ${
					!canRate
						? "!bg-gray-400 !text-white hover:!bg-gray-400 pointer-events-none disabled:opacity-100"
						: ""
				} ${className}`}
			>
				{children}
			</Button>
			{!canRate && showTooltip && (
				<div
					id={tooltipId}
					role="tooltip"
					className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg whitespace-nowrap pointer-events-none z-10"
				>
					{CANNOT_RATE_TOOLTIP_TEXT}
					<div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
				</div>
			)}
		</div>
	);
}
