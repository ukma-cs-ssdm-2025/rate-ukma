import { Checkbox } from "@/components/ui/Checkbox";
import type { SyncChange, SyncChangeFieldView } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { isSyncKind } from "../sync";
import { countWith, RATINGS } from "../syncFormat";
import { KIND_LABELS } from "../syncLabels";

const GRID =
	"sm:grid sm:grid-cols-[1.25rem_minmax(0,1fr)_7rem_minmax(0,16rem)_5rem] sm:items-baseline sm:gap-x-4";

function FieldChange({ row }: Readonly<{ row: SyncChangeFieldView }>) {
	const blanked = row.before !== "" && row.after === "";
	return (
		<li className="break-words">
			<span className="text-muted-foreground">{row.label}: </span>
			{row.before === "" ? null : (
				<>
					<del className="text-muted-foreground decoration-muted-foreground/60">
						{row.before}
					</del>
					<span aria-hidden="true"> → </span>
					<span className="sr-only"> стане </span>
				</>
			)}
			{blanked ? (
				<span className="text-destructive">порожньо</span>
			) : (
				<span>{row.after}</span>
			)}
		</li>
	);
}

function WhatChanges({ change }: Readonly<{ change: SyncChange }>) {
	if (change.view.rows.length > 0) {
		return (
			<ul className="space-y-0.5">
				{change.view.rows.map((row) => (
					<FieldChange key={`${row.field}-${row.after}`} row={row} />
				))}
			</ul>
		);
	}
	return (
		<p className="text-muted-foreground">
			{isSyncKind(change.kind) ? KIND_LABELS[change.kind] : change.kind}
		</p>
	);
}

export function SyncReviewHeader({
	selectable,
}: Readonly<{ selectable: boolean }>) {
	return (
		<div
			aria-hidden="true"
			className={cn(
				"hidden border-b px-4 py-2 text-sm text-muted-foreground sm:grid sm:px-5",
				GRID,
			)}
		>
			<span>{selectable ? "" : null}</span>
			<span>Запис</span>
			<span>Семестр</span>
			<span>Що зміниться</span>
			<span className="text-right">Оцінки</span>
		</div>
	);
}

export function SyncReviewRow({
	change,
	selectable,
	included,
	onToggle,
}: Readonly<{
	change: SyncChange;
	selectable: boolean;
	included: boolean;
	onToggle: (id: number, included: boolean) => void;
}>) {
	const id = `change-${change.id}`;
	return (
		<li
			className={cn(
				"flex gap-3 px-4 py-3 text-sm sm:px-5",
				GRID,
				!included && "text-muted-foreground",
			)}
		>
			<span className="pt-0.5">
				{selectable ? (
					<Checkbox
						aria-labelledby={id}
						checked={included}
						onCheckedChange={(value) => onToggle(change.id, value === true)}
					/>
				) : null}
			</span>
			<div className="min-w-0 flex-1 space-y-1 sm:contents">
				<div className="min-w-0">
					<p id={id} className="font-medium break-words">
						{change.view.title}
					</p>
					{change.view.place ? (
						<p className="break-words text-muted-foreground">
							{change.view.place}
						</p>
					) : null}
				</div>
				<p className="text-muted-foreground sm:text-foreground">
					{change.view.semester ?? ""}
				</p>
				<WhatChanges change={change} />
				<p className="text-muted-foreground tabular-nums sm:text-right sm:text-foreground">
					{change.ratings > 0 ? (
						<>
							<span className="sm:hidden">
								{countWith(change.ratings, RATINGS)}
							</span>
							<span className="hidden sm:inline">{change.ratings}</span>
						</>
					) : null}
				</p>
			</div>
		</li>
	);
}
