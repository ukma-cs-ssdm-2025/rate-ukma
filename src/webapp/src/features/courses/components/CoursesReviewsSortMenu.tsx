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

export type CoursesReviewsSortOption = "by-count" | "newest";

interface CoursesReviewsSortMenuProps {
	value: CoursesReviewsSortOption | null;
	onValueChange: (value: CoursesReviewsSortOption) => void;
}

const SORT_OPTIONS: ReadonlyArray<{
	value: CoursesReviewsSortOption;
	label: string;
}> = [
	{ value: "by-count", label: "За кількістю" },
	{ value: "newest", label: "Найновіші" },
];

export const COURSES_SORT_HINT =
	"«За кількістю» — спочатку курси з найбільшою кількістю відгуків, «Найновіші» — за датою останнього відгуку. Курси без відгуків завжди внизу.";

export function CoursesReviewsSortMenu({
	value,
	onValueChange,
}: Readonly<CoursesReviewsSortMenuProps>) {
	return (
		<div className="inline-flex items-center gap-1">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="-ml-2 inline-flex h-8 items-center gap-2 px-2 text-sm font-medium"
						aria-label="Сортування за відгуками"
					>
						<span>Відгуки</span>
						<ChevronDown className="h-4 w-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="center"
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
				<TooltipContent side="top" sideOffset={4}>
					<p>{COURSES_SORT_HINT}</p>
				</TooltipContent>
			</Tooltip>
		</div>
	);
}
