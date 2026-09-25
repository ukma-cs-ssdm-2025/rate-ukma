import type * as React from "react";

import { PenLine } from "lucide-react";

import { DisabledButtonWithTooltip } from "@/components/DisabledButtonWithTooltip";
import { Button } from "@/components/ui/Button";
import { CANNOT_RATE_TOOLTIP_TEXT } from "@/features/ratings/definitions/ratingDefinitions";
import { testIds } from "@/lib/test-ids";

interface RatingButtonProps {
	canRate: boolean;
	onClick: () => void;
	children: React.ReactNode;
}

export function RatingButton({
	canRate,
	onClick,
	children,
}: Readonly<RatingButtonProps>) {
	const button = (
		<Button
			size="lg"
			onClick={onClick}
			className="w-full sm:w-auto aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary"
			data-testid={testIds.courseDetails.rateButton}
		>
			<PenLine className="size-4" />
			{children}
		</Button>
	);

	if (canRate) {
		return button;
	}
	return (
		<DisabledButtonWithTooltip reason={CANNOT_RATE_TOOLTIP_TEXT}>
			{button}
		</DisabledButtonWithTooltip>
	);
}
