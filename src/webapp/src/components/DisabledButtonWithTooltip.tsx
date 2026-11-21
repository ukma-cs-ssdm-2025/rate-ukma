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

export function DisabledButtonWithTooltip({
	reason,
	children,
}: Readonly<Props>) {
	const [open, setOpen] = React.useState(false);
	const button = React.cloneElement(children, {
		"aria-disabled": true,
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
