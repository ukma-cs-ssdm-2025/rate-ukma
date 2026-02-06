import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";

export type SortOption = "newest" | "oldest" | "most-popular";

interface RatingsSortSelectProps {
	value: SortOption;
	onValueChange: (value: SortOption) => void;
}

const SORT_OPTIONS: Array<{
	value: SortOption;
	label: string;
	hint: string;
}> = [
	{
		value: "newest",
		label: "Найновіші",
		hint: "Спочатку свіжі",
	},
	{
		value: "oldest",
		label: "Найстаріші",
		hint: "Спочатку давні",
	},
	{
		value: "most-popular",
		label: "Найпопулярніші",
		hint: "Більше вподобань",
	},
];

export function RatingsSortSelect({
	value,
	onValueChange,
}: Readonly<RatingsSortSelectProps>) {
	const selectedOption = SORT_OPTIONS.find((option) => option.value === value);

	return (
		<Select value={value} onValueChange={onValueChange}>
			<SelectTrigger className="h-9 w-fit">
				<SelectValue placeholder={selectedOption?.label} />
			</SelectTrigger>
			<SelectContent>
				{SORT_OPTIONS.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
