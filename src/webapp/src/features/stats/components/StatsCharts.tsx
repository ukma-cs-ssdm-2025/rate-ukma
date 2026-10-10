import { useState } from "react";

import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	ReferenceLine,
	Scatter,
	ScatterChart,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";

import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/Chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import type { FacultyStats, PlatformStats } from "../statsData";

const number = new Intl.NumberFormat("uk-UA");
// Recharts animates on mount regardless of the OS setting, so honour it here.
const animate = !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
	.matches;
export const formatNumber = (value: number) => number.format(value);

const MONTHS = [
	"січ",
	"лют",
	"бер",
	"кві",
	"тра",
	"чер",
	"лип",
	"сер",
	"вер",
	"жов",
	"лис",
	"гру",
];
const monthLabel = (month: string) => {
	const [year, m] = month.split("-").map(Number);
	return m === 1 ? `${MONTHS[m - 1]} ${year}` : MONTHS[m - 1];
};

export function KpiStrip({
	items,
}: Readonly<{ items: { label: string; value: string }[] }>) {
	return (
		<dl className="grid grid-cols-2 gap-y-6 border-y py-6 lg:grid-cols-4 lg:divide-x">
			{items.map((item) => (
				<div key={item.label} className="lg:px-6 lg:first:pl-0">
					<dt className="text-sm text-muted-foreground">{item.label}</dt>
					<dd className="mt-1 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
						{item.value}
					</dd>
				</div>
			))}
		</dl>
	);
}

const activityConfig = {
	ratings: { label: "Оцінок", color: "var(--primary)" },
} satisfies ChartConfig;

export function ActivityChart({ stats }: Readonly<{ stats: PlatformStats }>) {
	const [view, setView] = useState<"months" | "years">("months");
	const years = stats.byAcademicYear.map((y) => ({
		year: `${y.year}–${String(y.year + 1).slice(2)}`,
		ratings: y.ratings,
	}));
	return (
		<section className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold tracking-tight">Активність</h2>
					<p className="text-sm text-muted-foreground">
						{view === "months"
							? "Коли студенти пишуть оцінки"
							: "За навчальним роком, коли слухали курс"}
					</p>
				</div>
				<ToggleGroup
					type="single"
					variant="outline"
					size="sm"
					value={view}
					onValueChange={(value) => value && setView(value as typeof view)}
				>
					<ToggleGroupItem value="months">За місяцями</ToggleGroupItem>
					<ToggleGroupItem value="years">За роком курсу</ToggleGroupItem>
				</ToggleGroup>
			</div>
			<ChartContainer
				config={activityConfig}
				className="aspect-auto h-64 w-full"
			>
				{view === "months" ? (
					<AreaChart
						data={stats.timeline}
						margin={{ left: 4, right: 12, top: 8 }}
					>
						<defs>
							<linearGradient id="fillRatings" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-ratings)"
									stopOpacity={0.35}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-ratings)"
									stopOpacity={0.02}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="month"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							tickFormatter={monthLabel}
						/>
						<YAxis tickLine={false} axisLine={false} width={36} />
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									indicator="line"
									labelFormatter={(_, payload) =>
										monthLabel(String(payload?.[0]?.payload?.month ?? ""))
									}
								/>
							}
						/>
						<Area
							isAnimationActive={animate}
							dataKey="ratings"
							type="monotone"
							fill="url(#fillRatings)"
							stroke="var(--color-ratings)"
							strokeWidth={2}
						/>
					</AreaChart>
				) : (
					<BarChart data={years} margin={{ left: 4, right: 12, top: 20 }}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="year"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
						/>
						<YAxis tickLine={false} axisLine={false} width={36} />
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent hideIndicator />}
						/>
						<Bar
							isAnimationActive={animate}
							dataKey="ratings"
							fill="var(--color-ratings)"
							radius={[6, 6, 0, 0]}
						>
							<LabelList
								dataKey="ratings"
								position="top"
								className="fill-foreground"
								fontSize={12}
							/>
						</Bar>
					</BarChart>
				)}
			</ChartContainer>
		</section>
	);
}

const scoresConfig = {
	difficulty: { label: "Складність", color: "var(--chart-5)" },
	usefulness: { label: "Корисність", color: "var(--primary)" },
} satisfies ChartConfig;

export function ScoresChart({ stats }: Readonly<{ stats: PlatformStats }>) {
	const data = [1, 2, 3, 4, 5].map((score) => ({
		score: String(score),
		difficulty: stats.difficulty[score - 1],
		usefulness: stats.usefulness[score - 1],
	}));
	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold tracking-tight">Як оцінюють</h2>
				<p className="text-sm text-muted-foreground">
					Скільки разів ставили кожну оцінку
				</p>
			</div>
			<ChartContainer config={scoresConfig} className="aspect-auto h-72 w-full">
				<BarChart data={data} margin={{ left: 4, right: 4, top: 8 }} barGap={3}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="score"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
					/>
					<YAxis tickLine={false} axisLine={false} width={36} />
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								labelFormatter={(value) => `Оцінка ${value}`}
							/>
						}
					/>
					<ChartLegend content={<ChartLegendContent />} />
					<Bar
						isAnimationActive={animate}
						dataKey="difficulty"
						fill="var(--color-difficulty)"
						radius={4}
					/>
					<Bar
						isAnimationActive={animate}
						dataKey="usefulness"
						fill="var(--color-usefulness)"
						radius={4}
					/>
				</BarChart>
			</ChartContainer>
		</section>
	);
}

function FacultyTooltip({
	active,
	payload,
}: Readonly<{ active?: boolean; payload?: { payload: FacultyStats }[] }>) {
	const f = payload?.[0]?.payload;
	if (!active || !f) return null;
	return (
		<div className="grid min-w-44 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
			<p className="font-medium">{f.name}</p>
			{[
				["Складність", f.difficulty.toFixed(2)],
				["Корисність", f.usefulness.toFixed(2)],
				["Оцінок", formatNumber(f.ratings)],
				["Курсів оцінено", `${f.ratedCourses} з ${formatNumber(f.courses)}`],
			].map(([label, value]) => (
				<div key={label} className="flex justify-between gap-4">
					<span className="text-muted-foreground">{label}</span>
					<span className="font-mono font-medium tabular-nums">{value}</span>
				</div>
			))}
		</div>
	);
}

// Faculties whose bubbles sit side by side get their label on the left.
const LABEL_LEFT = new Set(["ФСНСТ"]);

function BubbleLabel(
	props: Readonly<{
		x?: number | string;
		y?: number | string;
		width?: number | string;
		height?: number | string;
		value?: number | string;
	}>,
) {
	const x = Number(props.x ?? 0);
	const y = Number(props.y ?? 0);
	const width = Number(props.width ?? 0);
	const height = Number(props.height ?? 0);
	const left = LABEL_LEFT.has(String(props.value));
	return (
		<text
			x={left ? x - 6 : x + width + 6}
			y={y + height / 2}
			dy="0.35em"
			textAnchor={left ? "end" : "start"}
			className="fill-foreground text-[11px] font-medium"
		>
			{props.value}
		</text>
	);
}

/** Each faculty as a bubble: where it sits on difficulty × usefulness, sized by ratings. */
export function FacultyMap({
	stats,
	averages,
}: Readonly<{
	stats: PlatformStats;
	averages: { difficulty: number; usefulness: number };
}>) {
	const config = Object.fromEntries(
		stats.faculties.map((f) => [f.abbr, { label: f.abbr, color: f.color }]),
	) satisfies ChartConfig;
	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold tracking-tight">Факультети</h2>
				<p className="text-sm text-muted-foreground">
					Середні оцінки курсів, розмір кола показує кількість оцінок
				</p>
			</div>
			<ChartContainer config={config} className="aspect-auto h-72 w-full">
				<ScatterChart margin={{ left: 4, right: 16, top: 16, bottom: 16 }}>
					<CartesianGrid strokeDasharray="3 3" />
					<XAxis
						type="number"
						dataKey="difficulty"
						name="Складність"
						domain={[1.8, 3.8]}
						ticks={[2, 2.5, 3, 3.5]}
						tickLine={false}
						axisLine={false}
						label={{
							value: "Складність →",
							position: "insideBottomRight",
							offset: -12,
							className: "fill-muted-foreground text-[11px]",
						}}
					/>
					<YAxis
						type="number"
						dataKey="usefulness"
						name="Корисність"
						domain={[2.4, 4.2]}
						ticks={[2.5, 3, 3.5, 4]}
						tickLine={false}
						axisLine={false}
						width={36}
						label={{
							value: "↑ Корисність",
							position: "top",
							offset: 8,
							dx: 16,
							className: "fill-muted-foreground text-[11px]",
						}}
					/>
					<ZAxis type="number" dataKey="ratings" range={[120, 1600]} />
					<ReferenceLine
						x={averages.difficulty}
						strokeDasharray="4 4"
						className="stroke-muted-foreground/40"
					/>
					<ReferenceLine
						y={averages.usefulness}
						strokeDasharray="4 4"
						className="stroke-muted-foreground/40"
					/>
					<ChartTooltip cursor={false} content={<FacultyTooltip />} />
					<Scatter
						isAnimationActive={animate}
						data={stats.faculties}
						fillOpacity={0.85}
					>
						{stats.faculties.map((f) => (
							<Cell key={f.abbr} fill={f.color} />
						))}
						<LabelList dataKey="abbr" content={<BubbleLabel />} />
					</Scatter>
				</ScatterChart>
			</ChartContainer>
		</section>
	);
}

const participationConfig = {
	share: { label: "Оцінили", color: "var(--primary)" },
} satisfies ChartConfig;

export function ParticipationChart({
	stats,
}: Readonly<{ stats: PlatformStats }>) {
	const data = stats.faculties
		.map((f) => ({
			abbr: f.abbr,
			color: f.color,
			share: Math.round((f.studentsWhoRated / f.students) * 1000) / 10,
			label: `${f.studentsWhoRated} з ${formatNumber(f.students)}`,
		}))
		.sort((a, b) => b.share - a.share);
	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold tracking-tight">Хто оцінює</h2>
				<p className="text-sm text-muted-foreground">
					{`${formatNumber(stats.studentsWhoRated)} з ${formatNumber(stats.students)} студентів, частка за факультетом`}
				</p>
			</div>
			<ChartContainer
				config={participationConfig}
				className="aspect-auto h-72 w-full"
			>
				<BarChart data={data} layout="vertical" margin={{ left: 0, right: 48 }}>
					<XAxis type="number" hide domain={[0, "dataMax"]} />
					<YAxis
						type="category"
						dataKey="abbr"
						tickLine={false}
						axisLine={false}
						width={52}
					/>
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								hideIndicator
								formatter={(_, __, item) => (
									<span className="font-mono tabular-nums">
										{item.payload.label} студентів
									</span>
								)}
							/>
						}
					/>
					<Bar
						isAnimationActive={animate}
						dataKey="share"
						radius={4}
						barSize={18}
					>
						{data.map((d) => (
							<Cell key={d.abbr} fill={d.color} />
						))}
						<LabelList
							dataKey="share"
							position="right"
							formatter={(value: number) => `${value}%`}
							className="fill-muted-foreground"
							fontSize={12}
						/>
					</Bar>
				</BarChart>
			</ChartContainer>
		</section>
	);
}
