import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
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
				<p
					className="max-w-56 px-2 pt-1 pb-1.5 text-xs text-muted-foreground"
					data-testid={testIds.courses.sortInfoHint}
				>
					{COURSES_SORT_HINT}
				</p>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
