import * as React from "react";

interface Props {
	readonly children: React.ReactElement<{
		disabled?: boolean;
		className?: string;
	}>;
	readonly tooltip?: string;
	readonly className?: string;
	readonly forceDisable?: boolean;
}

export function DisabledButtonWithTooltip({
	children,
	tooltip,
	className,
	forceDisable = true,
}: Props) {
	const tooltipId = React.useId();

	let renderedChild = children;

	if (forceDisable) {
		const existingClassName = children.props.className ?? "";

		const mergedClassName = [existingClassName, "cursor-not-allowed"]
			.filter(Boolean)
			.join(" ");

		renderedChild = React.cloneElement(children, {
			disabled: true,
			className: mergedClassName,
		});
	}

	const isDisabled = forceDisable || children.props.disabled === true;

	return (
		<div
			className={`relative inline-block group ${className ?? ""}`}
			// Make wrapper focusable so keyboard users can reach the tooltip
			tabIndex={tooltip ? 0 : -1}
			// Expose disabled state to assistive tech
			aria-disabled={isDisabled || undefined}
			// Link wrapper to tooltip content
			aria-describedby={tooltip ? tooltipId : undefined}
		>
			{renderedChild}
			{tooltip ? (
				<div
					id={tooltipId}
					role="tooltip"
					className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-focus-within:opacity-100 group-hover:visible group-focus-within:visible transition-all duration-200 whitespace-nowrap pointer-events-none z-10"
				>
					{tooltip}
					<div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
				</div>
			) : null}
		</div>
	);
}

export default DisabledButtonWithTooltip;
