import type * as React from "react";

interface Props {
	readonly children: React.ReactNode;
	readonly tooltip?: string;
	readonly className?: string;
}

export function DisabledRatingButtonWithTooltip({
	children,
	tooltip,
	className,
}: Props) {
	return (
		<div className={(className ?? "") + " relative inline-block group"}>
			{children}
			{tooltip ? (
				<div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
					{tooltip}
					<div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
				</div>
			) : null}
		</div>
	);
}

export default DisabledRatingButtonWithTooltip;
