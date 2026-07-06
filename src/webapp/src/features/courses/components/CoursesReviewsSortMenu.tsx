import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

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

export function CoursesReviewsSortMenu({
	value,
	onValueChange,
}: Readonly<CoursesReviewsSortMenuProps>) {
	return (
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
	);
}
