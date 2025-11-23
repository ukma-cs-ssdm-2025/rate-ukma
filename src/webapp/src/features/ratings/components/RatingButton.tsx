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
}: Readonly<RatingButtonProps>) {
	const [showTooltip, setShowTooltip] = React.useState(false);
	const tooltipId = React.useId();

	const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
		if (!canRate) {
			e.preventDefault();
			return;
		}
		onClick?.();
	};

	return (
		<div
			className={`relative ${size === "lg" ? "w-full max-w-md" : "inline-block"}`}
		>
			<Button
				size={size}
				aria-disabled={!canRate}
				tabIndex={0}
				onClick={handleClick}
				onMouseEnter={() => !canRate && setShowTooltip(true)}
				onMouseLeave={() => setShowTooltip(false)}
				onFocus={() => !canRate && setShowTooltip(true)}
				onBlur={() => setShowTooltip(false)}
				asChild={canRate ? asChild : false}
				aria-describedby={canRate ? undefined : tooltipId}
				className={`${size === "lg" ? "w-full" : ""} ${
					canRate
						? ""
						: "!bg-gray-400 !text-white hover:!bg-gray-400 disabled:opacity-100"
				} ${className}`}
			>
				{children}
			</Button>
			{!canRate && (
				<div
					id={tooltipId}
					role="tooltip"
					aria-hidden={!showTooltip}
					className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg whitespace-nowrap pointer-events-none z-10 transition-all duration-200 ${
						showTooltip ? "opacity-100 visible" : "opacity-0 invisible"
					}`}
				>
					{CANNOT_RATE_TOOLTIP_TEXT}
					<div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
				</div>
			)}
		</div>
	);
}
