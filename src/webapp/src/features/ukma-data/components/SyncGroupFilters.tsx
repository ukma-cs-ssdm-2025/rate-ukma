import { useState } from "react";

import { Search, Shuffle } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { formatCount } from "../syncFormat";
import { KIND_TAB_LABELS } from "../syncLabels";
import type { SyncKind } from "../syncLabels";

export interface KindOption {
	kind: SyncKind;
	count: number;
}

interface GroupFiltersProps {
	kinds: readonly KindOption[];
	kind: SyncKind | null;
	q: string;
	rated: boolean;
	view: "sample" | "all";
	similar: boolean;
	similarCount: number | null;
	onKind: (kind: SyncKind) => void;
	onSearch: (q: string) => void;
	onRated: (rated: boolean) => void;
	onView: (view: "sample" | "all") => void;
	onSimilar: (similar: boolean) => void;
	onReseed: () => void;
}

function SearchBox({
	q,
	onSearch,
}: Readonly<{ q: string; onSearch: (q: string) => void }>) {
	const [draft, setDraft] = useState(q);
	return (
		<form
			role="search"
			className="relative w-full sm:w-72"
			onSubmit={(event) => {
				event.preventDefault();
				onSearch(draft.trim());
			}}
		>
			<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					if (draft.trim() !== q) {
						onSearch(draft.trim());
					}
				}}
				placeholder="Назва або код САЗ"
				aria-label="Пошук: назва або код САЗ"
				className="pl-8"
			/>
		</form>
	);
}

export function SyncGroupFilters({
	kinds,
	kind,
	q,
	rated,
	view,
	similar,
	similarCount,
	onKind,
	onSearch,
	onRated,
	onView,
	onSimilar,
	onReseed,
}: Readonly<GroupFiltersProps>) {
	return (
		<div className="space-y-3">
			<div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
				{kinds.length > 1 ? (
					<ToggleGroup
						type="single"
						variant="outline"
						value={kind ?? ""}
						aria-label="Тип"
						className="flex-wrap"
						onValueChange={(value) => {
							const next = kinds.find((item) => item.kind === value);
							if (next !== undefined) {
								onKind(next.kind);
							}
						}}
					>
						{kinds.map((item) => (
							<ToggleGroupItem
								key={item.kind}
								value={item.kind}
								className="gap-2 px-3"
							>
								{KIND_TAB_LABELS[item.kind]}
								<span className="text-muted-foreground tabular-nums">
									{formatCount(item.count)}
								</span>
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				) : null}
				<SearchBox key={q} q={q} onSearch={onSearch} />
				<div className="flex items-center gap-2">
					<Checkbox
						id="sync-rated"
						checked={rated}
						onCheckedChange={(value) => onRated(value === true)}
					/>
					<Label htmlFor="sync-rated" className="font-normal">
						з оцінками
					</Label>
				</div>
				{similarCount === null ? null : (
					<div className="flex items-center gap-2">
						<Checkbox
							id="sync-similar"
							checked={similar}
							onCheckedChange={(value) => onSimilar(value === true)}
						/>
						<Label htmlFor="sync-similar" className="font-normal tabular-nums">
							лише «схожий курс уже є» ({formatCount(similarCount)})
						</Label>
					</div>
				)}
			</div>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<span className="text-sm text-muted-foreground" id="sync-view-label">
					Показати:
				</span>
				<ToggleGroup
					type="single"
					variant="outline"
					value={view}
					aria-labelledby="sync-view-label"
					onValueChange={(value) => {
						if (value === "sample" || value === "all") {
							onView(value);
						}
					}}
				>
					<ToggleGroupItem value="sample" className="px-3">
						Зразок 20 з кожного факультету
					</ToggleGroupItem>
					<ToggleGroupItem value="all" className="px-3">
						Усі, по 50
					</ToggleGroupItem>
				</ToggleGroup>
				{view === "sample" ? (
					<Button variant="ghost" size="sm" onClick={onReseed}>
						<Shuffle />
						Інший зразок
					</Button>
				) : null}
			</div>
		</div>
	);
}
