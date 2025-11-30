import * as React from "react";

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
	const tooltipId = React.useId();

	const childDisabledProp = children.props.disabled === true;
	const shouldBeDisabled = forceDisable || childDisabledProp;

	const existingClassName = children.props.className ?? "";
	const mergedClassName = [
		existingClassName,
		shouldBeDisabled ? "cursor-not-allowed" : "",
		tooltip ? "peer" : "",
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
		disabled: tooltip ? undefined : shouldBeDisabled,
		...(tooltip ? { "aria-describedby": tooltipId } : {}),
		onClick: handleClick,
	});

	return (
		<div className={`relative inline-block ${className ?? ""}`}>
			{renderedChild}
			{tooltip ? (
				<div
					id={tooltipId}
					role="tooltip"
					className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-md shadow-lg opacity-0 invisible peer-hover:opacity-100 peer-focus-visible:opacity-100 peer-hover:visible peer-focus-visible:visible transition-all duration-200 whitespace-nowrap pointer-events-none z-10"
				>
					{tooltip}
					<div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
				</div>
			) : null}
		</div>
	);
}

export default DisabledButtonWithTooltip;
