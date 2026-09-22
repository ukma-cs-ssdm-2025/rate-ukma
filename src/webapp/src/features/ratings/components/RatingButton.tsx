import * as React from "react";

import { Button } from "@/components/ui/Button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { CANNOT_RATE_TOOLTIP_TEXT } from "@/features/ratings/definitions/ratingDefinitions";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";

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
	if (!canRate) {
		return (
			<div
				className={cn(
					size === "lg" ? "w-full max-w-md" : "inline-block",
					className,
				)}
			>
				<Tooltip>
					<TooltipTrigger asChild>
						<span
							className={size === "lg" ? "block w-full" : "inline-block"}
							tabIndex={0}
						>
							<Button
								size={size}
								disabled
								className={cn(size === "lg" && "w-full")}
								data-testid={testIds.courseDetails.rateButton}
							>
								{children}
							</Button>
						</span>
					</TooltipTrigger>
					<TooltipContent>
						<p>{CANNOT_RATE_TOOLTIP_TEXT}</p>
					</TooltipContent>
				</Tooltip>
			</div>
		);
	}

	return (
		<div
			className={cn(
				size === "lg" ? "w-full max-w-md" : "inline-block",
				className,
			)}
		>
			<Button
				size={size}
				onClick={onClick}
				asChild={asChild}
				className={cn(size === "lg" && "w-full")}
				data-testid={testIds.courseDetails.rateButton}
			>
				{children}
			</Button>
		</div>
	);
}
