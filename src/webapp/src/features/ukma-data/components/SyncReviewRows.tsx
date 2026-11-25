import { Checkbox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SyncChange, SyncChangeFieldView } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { isSyncKind } from "../sync";
import { countWith, RATINGS } from "../syncFormat";
import { KIND_LABELS } from "../syncLabels";
import { wordDiff } from "../textDiff";
import type { DiffPart } from "../textDiff";

const GRID =
	"sm:grid sm:grid-cols-[1.25rem_minmax(0,1fr)_7rem_minmax(0,18rem)_4rem] sm:items-start sm:gap-x-4";

function linkNoun(kind: string): string | null {
	switch (kind) {
		case "link_faculty":
			return "Факультет";
		case "link_department":
			return "Кафедра";
		case "link_course":
			return "Дисципліна";
		case "link_offering":
			return "Дисципліна в семестрі";
		default:
			return null;
	}
}

function DiffText({ parts }: Readonly<{ parts: readonly DiffPart[] }>) {
	return (
		<>
			{parts.map((part, index) =>
				part.kind === "same" ? (
					<span key={index}>{part.text}</span>
				) : part.kind === "removed" ? (
					<del
						key={index}
						className="rounded-sm bg-destructive/10 px-0.5 text-destructive decoration-destructive/60"
					>
						{part.text}
					</del>
				) : (
					<ins
						key={index}
						className="rounded-sm bg-success/15 px-0.5 text-success no-underline"
					>
						{part.text}
					</ins>
				),
			)}
		</>
	);
}

const isShort = (value: string): boolean =>
	value.length <= 14 && !value.includes(" ");

function Comparison({
	row,
	link,
}: Readonly<{ row: SyncChangeFieldView; link: boolean }>) {
	const diff = wordDiff(row.before, row.after);
	const [was, will] = link ? ["На сайті", "У САЗ"] : ["Було", "Стане"];
	return (
		<li className="space-y-0.5">
			{link ? null : <p className="text-muted-foreground">{row.label}</p>}
			<p className="break-words">
				<span className="text-muted-foreground">{was}: </span>
				<DiffText parts={diff.before} />
			</p>
			<p className="break-words">
				<span className="text-muted-foreground">{will}: </span>
				<DiffText parts={diff.after} />
			</p>
		</li>
	);
}

function FieldChange({
	row,
	link,
}: Readonly<{ row: SyncChangeFieldView; link: boolean }>) {
	if (row.before !== "" && row.after !== "" && !isShort(row.before)) {
		return <Comparison row={row} link={link} />;
	}
	return (
		<li className="break-words">
			<span className="text-muted-foreground">{row.label}: </span>
			{row.before === "" ? null : (
				<>
					<del className="text-destructive decoration-destructive/60">
						{row.before}
					</del>
					<span aria-hidden="true"> → </span>
					<span className="sr-only"> стане </span>
				</>
			)}
			{row.before !== "" && row.after === "" ? (
				<span className="text-destructive">порожньо</span>
			) : (
				<span className={row.before === "" ? undefined : "text-success"}>
					{row.after}
				</span>
			)}
		</li>
	);
}

function WhatChanges({ change }: Readonly<{ change: SyncChange }>) {
	const link = change.group === "link";
	if (change.view.rows.length > 0) {
		return (
			<ul className="space-y-1.5">
				{change.view.rows.map((row) => (
					<FieldChange
						key={`${row.field}-${row.after}`}
						row={row}
						link={link}
					/>
				))}
			</ul>
		);
	}
	const noun = link ? linkNoun(change.kind) : null;
	return (
		<p className="text-muted-foreground">
			{noun ??
				(isSyncKind(change.kind) ? KIND_LABELS[change.kind] : change.kind)}
		</p>
	);
}

export function SyncReviewHeader({
	selectable,
	column,
}: Readonly<{ selectable: boolean; column: string }>) {
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
			<span>{column}</span>
			<span className="text-right">Оцінки</span>
		</div>
	);
}

export function SyncReviewSkeleton() {
	return (
		<div
			role="status"
			aria-label="Завантажую зміни"
			className="overflow-hidden rounded-xl border bg-card"
		>
			{[0, 1, 2, 3, 4].map((row) => (
				<div
					key={row}
					className={cn(
						"flex gap-3 border-b px-4 py-3 last:border-b-0 sm:px-5",
						GRID,
					)}
				>
					<Skeleton className="size-4 rounded-sm" />
					<div className="flex-1 space-y-2">
						<Skeleton className="h-4 w-3/5" />
						<Skeleton className="h-4 w-2/5" />
					</div>
					<Skeleton className="hidden h-4 w-20 sm:block" />
					<Skeleton className="hidden h-4 w-40 sm:block" />
					<Skeleton className="hidden h-4 w-8 justify-self-end sm:block" />
				</div>
			))}
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
			<span className="flex h-5 items-center">
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
				{change.view.semester ? (
					<p className="text-muted-foreground sm:text-foreground">
						{change.view.semester}
					</p>
				) : (
					<span className="hidden sm:block" />
				)}
				<WhatChanges change={change} />
				{change.ratings > 0 ? (
					<p className="text-muted-foreground tabular-nums sm:text-right sm:text-foreground">
						<span className="sm:hidden">
							{countWith(change.ratings, RATINGS)}
						</span>
						<span className="hidden sm:inline">{change.ratings}</span>
					</p>
				) : (
					<span className="hidden sm:block" />
				)}
			</div>
		</li>
	);
}
