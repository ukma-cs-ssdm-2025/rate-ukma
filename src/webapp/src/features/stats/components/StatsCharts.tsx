import { type ReactNode, useState } from "react";

import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { FacultyStats } from "../statsData";

const number = new Intl.NumberFormat("uk-UA");
export const formatNumber = (value: number) => number.format(value);

export function StatTile({
	label,
	value,
	hint,
}: Readonly<{ label: string; value: string; hint?: string }>) {
	return (
		<Card className="shadow-sm">
			<CardContent className="p-4 sm:p-5">
				<p className="text-sm text-muted-foreground">{label}</p>
				<p className="mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
					{value}
				</p>
				{hint ? (
					<p className="mt-1 text-sm text-muted-foreground">{hint}</p>
				) : null}
			</CardContent>
		</Card>
	);
}

export function ChartCard({
	title,
	children,
	className,
}: Readonly<{ title: string; children: ReactNode; className?: string }>) {
	return (
		<Card className={cn("shadow-sm", className)}>
			<CardContent className="p-4 sm:p-5">
				<h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
				<div className="mt-4">{children}</div>
			</CardContent>
		</Card>
	);
}

/** Vertical bars with the value on top; for a handful of labelled columns. */
export function ColumnChart({
	items,
	barClassName,
	height = 140,
}: Readonly<{
	items: { key: string; label: string; value: number; display?: string }[];
	barClassName: string;
	height?: number;
}>) {
	const max = Math.max(...items.map((item) => item.value), 1);
	return (
		<div
			className="flex items-end gap-2 sm:gap-3"
			style={{ height: height + 44 }}
		>
			{items.map((item) => (
				<div
					key={item.key}
					className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
				>
					<span className="text-xs font-medium tabular-nums">
						{item.display ?? formatNumber(item.value)}
					</span>
					<div
						className={cn("w-full max-w-14 rounded-t-md", barClassName)}
						style={{ height: Math.max(3, (item.value / max) * height) }}
					/>
					<span className="truncate text-xs text-muted-foreground">
						{item.label}
					</span>
				</div>
			))}
		</div>
	);
}

/** How the 1..5 scores split, as one row of five columns. */
export function ScoreSplit({
	counts,
	barClassName,
}: Readonly<{ counts: number[]; barClassName: string }>) {
	const total = counts.reduce((a, b) => a + b, 0) || 1;
	return (
		<ColumnChart
			height={96}
			barClassName={barClassName}
			items={counts.map((count, i) => ({
				key: String(i + 1),
				label: String(i + 1),
				value: count,
				display: `${Math.round((count / total) * 100)}%`,
			}))}
		/>
	);
}

const MONTHS_IN = [
	"січні",
	"лютому",
	"березні",
	"квітні",
	"травні",
	"червні",
	"липні",
	"серпні",
	"вересні",
	"жовтні",
	"листопаді",
	"грудні",
];
const MONTHS = [
	"Січ",
	"Лют",
	"Бер",
	"Кві",
	"Тра",
	"Чер",
	"Лип",
	"Сер",
	"Вер",
	"Жов",
	"Лис",
	"Гру",
];
// Academic order: the year starts in September.
const ACADEMIC_ORDER = [8, 9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7];

/** Twelve cells shaded by how many ratings each month gets. */
export function MonthStrip({ byMonth }: Readonly<{ byMonth: number[] }>) {
	const max = Math.max(...byMonth, 1);
	const [active, setActive] = useState<number | null>(null);
	const [first, second] = byMonth
		.map((count, m) => ({ count, m }))
		.sort((a, b) => b.count - a.count);
	return (
		<div>
			<div className="grid grid-cols-12 gap-1">
				{ACADEMIC_ORDER.map((m) => (
					<div
						key={m}
						className="flex flex-col items-center gap-1.5"
						onPointerEnter={() => setActive(m)}
						onPointerLeave={() => setActive(null)}
					>
						<div className="flex h-36 w-full items-end">
							<div
								className={cn(
									"w-full rounded-t-md bg-primary transition-opacity",
									active != null && active !== m && "opacity-30",
								)}
								style={{ height: `${Math.max(2, (byMonth[m] / max) * 100)}%` }}
							/>
						</div>
						<span
							className={cn(
								"text-[11px] text-muted-foreground",
								active === m && "font-medium text-foreground",
							)}
						>
							{MONTHS[m]}
						</span>
					</div>
				))}
			</div>
			<p className="mt-3 h-5 text-sm text-muted-foreground">
				{active == null
					? `Найбільше у ${MONTHS_IN[first.m]} та ${MONTHS_IN[second.m]}`
					: `${MONTHS[active]}: ${formatNumber(byMonth[active])} оцінок`}
			</p>
		</div>
	);
}

/** Below this, a faculty average is a handful of opinions, so it is shown muted. */
const MIN_FACULTY_RATINGS = 50;

export function FacultyList({
	faculties,
}: Readonly<{ faculties: FacultyStats[] }>) {
	const max = Math.max(...faculties.map((f) => f.ratings), 1);
	return (
		<Card className="shadow-sm">
			<CardContent className="p-0">
				<div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-x-4 border-b px-4 py-3 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_5rem_5rem] sm:px-5">
					<span>Факультет</span>
					<span className="hidden sm:block">Оцінки</span>
					<span className="text-right">Складність</span>
					<span className="text-right">Корисність</span>
				</div>
				<ul className="divide-y">
					{faculties.map((f) => (
						<li
							key={f.abbr}
							className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_5rem_5rem] sm:px-5"
						>
							<div className="min-w-0">
								<p className="font-medium">{f.abbr}</p>
								<p className="text-xs text-muted-foreground sm:truncate">
									{f.name}
								</p>
							</div>
							<div className="order-last col-span-3 flex items-center gap-3 sm:order-none sm:col-span-1">
								<div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full rounded-full bg-primary"
										style={{ width: `${(f.ratings / max) * 100}%` }}
									/>
								</div>
								<span
									className="w-12 shrink-0 text-right text-sm tabular-nums"
									title={`Оцінено ${f.ratedCourses} з ${formatNumber(f.courses)}`}
								>
									{formatNumber(f.ratings)}
								</span>
							</div>
							<span
								className={cn(
									"text-right text-base font-semibold tabular-nums",
									f.ratings < MIN_FACULTY_RATINGS && "text-muted-foreground/60",
								)}
							>
								{f.difficulty.toFixed(1)}
							</span>
							<span
								className={cn(
									"text-right text-base font-semibold tabular-nums",
									f.ratings < MIN_FACULTY_RATINGS && "text-muted-foreground/60",
								)}
							>
								{f.usefulness.toFixed(1)}
							</span>
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

/** Three stages of the same population, drawn to one scale on purpose. */
export function Funnel({
	steps,
}: Readonly<{ steps: { label: string; value: number }[] }>) {
	const max = Math.max(...steps.map((step) => step.value), 1);
	return (
		<div className="space-y-3">
			{steps.map((step, i) => (
				<div key={step.label}>
					<div className="flex items-baseline justify-between gap-3 text-sm">
						<span className="text-muted-foreground">{step.label}</span>
						<span className="font-semibold tabular-nums">
							{formatNumber(step.value)}
						</span>
					</div>
					<div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary"
							style={{
								width: `${Math.max(0.6, (step.value / max) * 100)}%`,
								opacity: 0.45 + 0.55 * (i / Math.max(1, steps.length - 1)),
							}}
						/>
					</div>
				</div>
			))}
		</div>
	);
}

/** Share of each faculty's students who rated anything. */
export function ParticipationList({
	faculties,
}: Readonly<{ faculties: FacultyStats[] }>) {
	const rows = faculties
		.map((f) => ({ ...f, share: f.studentsWhoRated / f.students }))
		.sort((a, b) => b.share - a.share);
	const max = Math.max(...rows.map((r) => r.share), 0.01);
	return (
		<div className="space-y-2.5">
			{rows.map((r) => (
				<div
					key={r.abbr}
					className="grid grid-cols-[3.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm"
					title={`${r.studentsWhoRated} з ${formatNumber(r.students)} студентів`}
				>
					<span className="font-medium">{r.abbr}</span>
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full bg-primary"
							style={{ width: `${(r.share / max) * 100}%` }}
						/>
					</div>
					<span className="text-right tabular-nums text-muted-foreground">
						{(r.share * 100).toFixed(1)}%
					</span>
				</div>
			))}
		</div>
	);
}
