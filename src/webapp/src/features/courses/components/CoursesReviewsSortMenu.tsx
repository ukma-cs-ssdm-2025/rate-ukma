import { Check, ChevronDown, Info } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/Tooltip";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";

export type CoursesReviewsSortOption = "by-count" | "newest";

interface CoursesReviewsSortMenuProps {
	value: CoursesReviewsSortOption | null;
	onValueChange: (value: CoursesReviewsSortOption) => void;
	/** Phones have no reviews column, so the menu sits in the title header. */
	variant?: "desktop" | "mobile";
}

const SORT_OPTIONS: ReadonlyArray<{
	value: CoursesReviewsSortOption;
	label: string;
}> = [
	{ value: "by-count", label: "За кількістю" },
	{ value: "newest", label: "Найновіші" },
];

export const COURSES_SORT_HINT = "Курси без відгуків завжди внизу.";

export function CoursesReviewsSortMenu({
	value,
	onValueChange,
	variant = "desktop",
}: Readonly<CoursesReviewsSortMenuProps>) {
	const isMobile = variant === "mobile";
	return (
		<div className="inline-flex items-center gap-1">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className={cn(
							"-ml-2 inline-flex h-8 items-center gap-2 px-2 text-sm font-medium",
							isMobile &&
								"h-10 gap-1 whitespace-nowrap text-xs text-muted-foreground [&_svg]:size-3.5",
						)}
						aria-label="Сортування за відгуками"
						data-testid={
							isMobile ? testIds.courses.reviewsSortButtonMobile : undefined
						}
					>
						<span>Відгуки</span>
						<ChevronDown className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align={isMobile ? "start" : "center"}
					onCloseAutoFocus={(event) => event.preventDefault()}
				>
					{SORT_OPTIONS.map((option) => {
						const isSelected = option.value === value;
						return (
							<DropdownMenuItem
								key={option.value}
								onSelect={() => onValueChange(option.value)}
								className="pr-8"
							>
								{option.label}
								{isSelected && <Check className="absolute right-2 size-4" />}
							</DropdownMenuItem>
						);
					})}
				</DropdownMenuContent>
			</DropdownMenu>
			{!isMobile && (
				<Tooltip delayDuration={0}>
					<TooltipTrigger asChild>
						<button
							type="button"
							aria-label={COURSES_SORT_HINT}
							data-testid={testIds.courses.sortInfoHint}
							className="shrink-0 text-muted-foreground"
						>
							<Info className="h-3.5 w-3.5" aria-hidden="true" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="top" sideOffset={4} className="max-w-lg">
						<p>{COURSES_SORT_HINT}</p>
					</TooltipContent>
				</Tooltip>
			)}
		</div>
	);
}
