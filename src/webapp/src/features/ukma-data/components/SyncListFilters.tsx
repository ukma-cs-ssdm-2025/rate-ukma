import { Search } from "lucide-react";

import { Input } from "@/components/ui/Input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { academicYears, yearLabel } from "../syncReviewList";

const ALL_YEARS = "all";

export function SyncListFilters({
	query,
	onQuery,
	year,
	onYear,
}: Readonly<{
	query: string;
	onQuery: (query: string) => void;
	year: number | null;
	onYear: ((year: number | null) => void) | null;
}>) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
			<div className="relative sm:max-w-sm sm:flex-1">
				<Search
					aria-hidden
					className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
				/>
				<Input
					type="search"
					value={query}
					onChange={(event) => onQuery(event.target.value)}
					aria-label="Пошук у змінах"
					placeholder="Назва, кафедра або код САЗ"
					className="h-9 pl-9"
				/>
			</div>
			{onYear === null ? null : (
				<Select
					value={year === null ? ALL_YEARS : String(year)}
					onValueChange={(value) =>
						onYear(value === ALL_YEARS ? null : Number(value))
					}
				>
					<SelectTrigger aria-label="Навчальний рік" className="gap-1.5">
						<span className="text-muted-foreground">Рік:</span>
						<span className="font-semibold">
							<SelectValue />
						</span>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_YEARS}>усі</SelectItem>
						{academicYears().map((item) => (
							<SelectItem key={item} value={String(item)}>
								{yearLabel(item)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			)}
		</div>
	);
}
