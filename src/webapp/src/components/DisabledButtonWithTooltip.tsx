import * as React from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";

interface Props {
	readonly children: React.ReactElement<
		React.ButtonHTMLAttributes<HTMLButtonElement>
	>;
	readonly tooltip?: string;
	readonly className?: string;
	readonly forceDisable?: boolean;
}

export function DisabledButtonWithTooltip({
	children,
	tooltip,
	className,
	forceDisable = true,
}: Readonly<Props>) {
	const childDisabledProp = children.props.disabled === true;
	const shouldBeDisabled = forceDisable || childDisabledProp;

	const existingClassName = children.props.className ?? "";
	const mergedClassName = [
		existingClassName,
		shouldBeDisabled ? "cursor-not-allowed" : "",
	]
		.filter(Boolean)
		.join(" ");

	const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
		if (shouldBeDisabled) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		if (typeof children.props.onClick === "function") {
			children.props.onClick(event);
		}
	};

	const renderedChild = React.cloneElement(children, {
		className: mergedClassName,
		"aria-disabled": shouldBeDisabled || undefined,
		disabled: shouldBeDisabled,
		onClick: handleClick,
	});

	if (!tooltip) {
		return (
			<div className={`inline-block ${className ?? ""}`}>{renderedChild}</div>
		);
	}

	return (
		<div className={`inline-block ${className ?? ""}`}>
			<Tooltip>
				<TooltipTrigger asChild>
					{/* span keeps the tooltip reachable on a disabled native button */}
					<span className="inline-block" tabIndex={0}>
						{renderedChild}
					</span>
				</TooltipTrigger>
				<TooltipContent>
					<p>{tooltip}</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}

export default DisabledButtonWithTooltip;
