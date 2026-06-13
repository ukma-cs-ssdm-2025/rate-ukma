import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
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
					className="h-7 w-7 p-0"
					aria-label="Сортування за відгуками"
				>
					<ChevronDown className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="center">
				<DropdownMenuRadioGroup
					value={value ?? ""}
					onValueChange={(next) =>
						onValueChange(next as CoursesReviewsSortOption)
					}
				>
					{SORT_OPTIONS.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value}>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
