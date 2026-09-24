import * as React from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";

interface Props {
	readonly reason: string;
	readonly children: React.ReactElement<
		React.ButtonHTMLAttributes<HTMLButtonElement>
	>;
}

// aria-disabled instead of disabled keeps the button focusable, so keyboard
// users reach the reason; a tap opens it for touch users, who cannot hover.
export function DisabledButtonWithTooltip({ reason, children }: Props) {
	const [open, setOpen] = React.useState(false);
	const button = React.cloneElement(children, {
		"aria-disabled": true,
		// Prevented events stop Radix from closing the tooltip on press.
		onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) =>
			event.preventDefault(),
		onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
			event.preventDefault();
			setOpen(true);
		},
	});

	return (
		<Tooltip delayDuration={0} open={open} onOpenChange={setOpen}>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent side="top" sideOffset={4}>
				<p>{reason}</p>
			</TooltipContent>
		</Tooltip>
	);
}
