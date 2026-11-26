import { Search } from "lucide-react";

import { Input } from "@/components/ui/Input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import type { SyncPendingResponse } from "@/lib/api/generated";
import { fieldLabel } from "../sync";
import { formatCount } from "../syncFormat";
import { academicYears, yearLabel } from "../syncListFilters";
import { DataSegments } from "./DataBits";

const ALL_FIELDS = "all";

const SEGMENT_FIELDS = 5;

export function FieldFilter({
	page,
	field,
	onChange,
}: Readonly<{
	page: SyncPendingResponse;
	field: string | null;
	onChange: (field: string | null) => void;
}>) {
	const fields = Object.entries(page.changed_fields).sort(
		([, left], [, right]) => right - left,
	);
	if (fields.length < 2) {
		return null;
	}
	const items: readonly { value: string; label: string; count?: number }[] = [
		{ value: ALL_FIELDS, label: "Усі поля" },
		...fields.map(([name, count]) => ({
			value: name,
			label: fieldLabel(name),
			count,
		})),
	];
	const pick = (value: string) => onChange(value === ALL_FIELDS ? null : value);
	if (fields.length <= SEGMENT_FIELDS) {
		return (
			<DataSegments
				label="Яке поле змінюється"
				value={field ?? ALL_FIELDS}
				onChange={pick}
				items={items}
			/>
		);
	}
	return (
		<div className="flex flex-wrap items-center gap-2 text-sm">
			<span id="sync-field-filter" className="text-muted-foreground">
				Яке поле змінюється
			</span>
			<Select value={field ?? ALL_FIELDS} onValueChange={pick}>
				<SelectTrigger
					aria-labelledby="sync-field-filter"
					className="h-9 w-fit min-w-48"
				>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{items.map((item) => (
						<SelectItem key={item.value} value={item.value}>
							{item.label}
							{item.count === undefined ? null : (
								<span className="ml-2 text-muted-foreground tabular-nums">
									{formatCount(item.count)}
								</span>
							)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

const ALL_YEARS = "all";

export function SearchFilter({
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
			<div className="relative sm:w-80">
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
					maxLength={200}
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
					<SelectTrigger
						aria-label="Навчальний рік"
						className="h-9 w-fit min-w-40"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_YEARS}>Усі роки</SelectItem>
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
