import { useState } from "react";

import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Label,
	LabelList,
	Pie,
	PieChart,
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
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/Chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { FacultyStats, PlatformStats } from "../statsData";

const number = new Intl.NumberFormat("uk-UA");
// Recharts animates on mount regardless of the OS setting, so honour it here.
const animate = !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
	.matches;
export const formatNumber = (value: number) => number.format(value);
const percent = (part: number, total: number) =>
	Math.round((part / (total || 1)) * 1000) / 10;
const formatPercent = (value: number) =>
	`${value >= 10 ? Math.round(value) : value}%`;

function SectionTitle({
	title,
	description,
}: Readonly<{ title: string; description: string }>) {
	return (
		<div>
			<h2 className="text-lg font-semibold tracking-tight">{title}</h2>
			<p className="text-sm text-muted-foreground">{description}</p>
		</div>
	);
}

/** Tooltip row that prints a share next to the raw count it came from. */
function percentFormatter(config: ChartConfig, countKey?: string) {
	return (
		value: unknown,
		name: unknown,
		item: {
			color?: string;
			dataKey?: unknown;
			payload?: Record<string, number>;
		},
	) => (
		<div className="flex w-full items-center gap-2">
			<span
				className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
				style={{ backgroundColor: item.color }}
			/>
			<span className="flex-1 text-muted-foreground">
				{config[String(name)]?.label ?? String(name)}
			</span>
			<span className="font-mono font-medium tabular-nums">
				{formatPercent(Number(value))}
			</span>
			<span className="font-mono text-muted-foreground tabular-nums">
				{formatNumber(
					item.payload?.[countKey ?? `${String(item.dataKey)}Count`] ?? 0,
				)}
			</span>
		</div>
	);
}

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
	const [view, setView] = useState<"months" | "years" | "lag">("months");
	const lagTotal = stats.lag.reduce((sum, l) => sum + l.ratings, 0);
	const lag = stats.lag.map((l) => ({
		label: ["той же рік", "1 рік", "2 роки", "3 роки", "4 роки", "5+ років"][
			l.years
		],
		ratings: percent(l.ratings, lagTotal),
		count: l.ratings,
	}));
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
						{
							{
								months: "Коли студенти пишуть оцінки",
								years: "За навчальним роком, коли слухали курс",
								lag: "Через скільки років після курсу оцінюють",
							}[view]
						}
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
					<ToggleGroupItem value="lag">Після курсу</ToggleGroupItem>
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
				) : view === "lag" ? (
					<BarChart data={lag} margin={{ left: 4, right: 12, top: 20 }}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="label"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
						/>
						<YAxis
							tickLine={false}
							axisLine={false}
							width={36}
							tickFormatter={(v: number) => `${v}%`}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(value) =>
										value === "той же рік"
											? "Того ж навчального року"
											: `Через ${value}`
									}
									formatter={percentFormatter(activityConfig, "count")}
								/>
							}
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
								formatter={formatPercent}
								className="fill-foreground"
								fontSize={12}
							/>
						</Bar>
					</BarChart>
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

const SCORE_KEYS = ["s1", "s2", "s3", "s4", "s5"] as const;
// Lightest for 1, full colour for 5: one hue per metric, darker means higher.
const SCORE_OPACITY = [0.22, 0.4, 0.58, 0.78, 1];

type ScoreRow = { label: string; counts: number[] };

function scoreRows(rows: ScoreRow[]) {
	return rows.map((row) => {
		const total = row.counts.reduce((sum, c) => sum + c, 0) || 1;
		const entry: Record<string, number | string> = {
			label: row.label,
			avg: row.counts.reduce((sum, c, i) => sum + c * (i + 1), 0) / total,
		};
		row.counts.forEach((count, i) => {
			entry[SCORE_KEYS[i]] = percent(count, total);
			entry[`${SCORE_KEYS[i]}Count`] = count;
		});
		return entry;
	});
}

const scoreConfig = Object.fromEntries(
	SCORE_KEYS.map((key, i) => [key, { label: `Оцінка ${i + 1}` }]),
) satisfies ChartConfig;

const ROW_HEIGHT = 40;

/** 100% bars of how often each score from 1 to 5 was given, one row per group. */
function ScoreSplitPanel({
	title,
	color,
	rows,
}: Readonly<{ title: string; color: string; rows: ScoreRow[] }>) {
	const data = scoreRows(rows);
	// Phones leave a segment too narrow for its percentage; the tooltip has it.
	const showLabels = useMediaQuery("(min-width: 640px)");
	return (
		<div>
			<div className="mb-2 flex items-baseline justify-between gap-3">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-xs text-muted-foreground">середнє</p>
			</div>
			<div className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3">
				<ChartContainer
					config={scoreConfig}
					className="aspect-auto w-full"
					style={{ height: data.length * ROW_HEIGHT }}
				>
					<BarChart
						data={data}
						layout="vertical"
						margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
						barCategoryGap={8}
					>
						<XAxis type="number" hide domain={[0, 100]} />
						<YAxis
							type="category"
							dataKey="label"
							tickLine={false}
							axisLine={false}
							width={76}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									hideIndicator
									formatter={percentFormatter(scoreConfig)}
								/>
							}
						/>
						{SCORE_KEYS.map((key, i) => (
							<Bar
								key={key}
								isAnimationActive={animate}
								dataKey={key}
								stackId="split"
								fill={color}
								fillOpacity={SCORE_OPACITY[i]}
								stroke="var(--card)"
								strokeWidth={2}
								radius={i === 0 ? [4, 0, 0, 4] : i === 4 ? [0, 4, 4, 0] : 0}
							>
								<LabelList
									dataKey={key}
									position="center"
									formatter={(v: number) =>
										showLabels && v >= 9 ? formatPercent(v) : ""
									}
									className={i >= 3 ? "fill-white" : "fill-foreground"}
									fontSize={11}
								/>
							</Bar>
						))}
					</BarChart>
				</ChartContainer>
				<div>
					{data.map((row) => (
						<p
							key={String(row.label)}
							className="text-right text-sm font-semibold tabular-nums"
							style={{ lineHeight: `${ROW_HEIGHT}px` }}
						>
							{Number(row.avg).toFixed(1)}
						</p>
					))}
				</div>
			</div>
		</div>
	);
}

function ScoreScale({ color }: Readonly<{ color: string }>) {
	return (
		<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
			<span>1</span>
			{SCORE_OPACITY.map((opacity) => (
				<span
					key={opacity}
					className="h-2.5 w-5 rounded-[2px]"
					style={{ backgroundColor: color, opacity }}
				/>
			))}
			<span>5</span>
		</div>
	);
}

export function ScoresChart({ stats }: Readonly<{ stats: PlatformStats }>) {
	const rows = (metric: "difficulty" | "usefulness") => [
		{ label: "Усі", counts: stats[metric] },
		{ label: "Анонімно", counts: stats.scoresByAnonymity.anonymous[metric] },
		{ label: "З іменем", counts: stats.scoresByAnonymity.named[metric] },
	];
	return (
		<section className="space-y-5">
			<SectionTitle
				title="Як оцінюють"
				description="Частка кожної оцінки від 1 до 5"
			/>
			<ScoreSplitPanel
				title="Складність"
				color="var(--destructive)"
				rows={rows("difficulty")}
			/>
			<ScoreSplitPanel
				title="Корисність"
				color="var(--primary)"
				rows={rows("usefulness")}
			/>
			<div className="flex flex-wrap gap-x-6 gap-y-2">
				<ScoreScale color="var(--destructive)" />
				<ScoreScale color="var(--primary)" />
			</div>
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

function Caption({ children }: Readonly<{ children: string }>) {
	return <p className="mb-3 text-sm font-medium">{children}</p>;
}

const reachConfig = {
	rated: { label: "Оцінили" },
	account: { label: "Лише увійшли" },
	rest: { label: "Не заходили" },
} satisfies ChartConfig;

/** Current students per faculty as one 100% bar: rated, signed in only, never came. */
export function ParticipationSection({
	stats,
}: Readonly<{ stats: PlatformStats }>) {
	const row = (
		key: string,
		color: string,
		total: number,
		account: number,
		rated: number,
	) => ({
		key,
		color,
		rated: percent(rated, total),
		account: percent(account - rated, total),
		rest: percent(total - account, total),
		ratedCount: rated,
		accountCount: account - rated,
		restCount: total - account,
		ratedShare: formatPercent(percent(rated, total)),
		accountShare: formatPercent(percent(account, total)),
	});
	const data = [
		row(
			"Усі",
			"var(--foreground)",
			stats.currentStudents,
			stats.currentWithAccount,
			stats.currentWhoRated,
		),
		...stats.faculties
			.map((f) =>
				row(
					f.abbr,
					f.color,
					f.currentStudents,
					f.currentWithAccount,
					f.currentWhoRated,
				),
			)
			.sort((x, y) => y.rated - x.rated),
	];
	const segments = [
		{ key: "rated", opacity: 1 },
		{ key: "account", opacity: 0.35 },
	] as const;
	return (
		<section className="space-y-5">
			<SectionTitle
				title="Хто оцінює"
				description={`Студенти, що навчаються зараз: ${formatNumber(stats.currentStudents)}, без випускників`}
			/>
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4">
				<span />
				<p className="text-right text-xs text-muted-foreground">
					<span>оцінили</span>
					<span className="ml-2">увійшли</span>
				</p>
				<ChartContainer
					config={reachConfig}
					className="aspect-auto w-full"
					style={{ height: data.length * ROW_HEIGHT }}
				>
					<BarChart
						data={data}
						layout="vertical"
						margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
						barCategoryGap={10}
					>
						<XAxis type="number" hide domain={[0, 100]} />
						<YAxis
							type="category"
							dataKey="key"
							tickLine={false}
							axisLine={false}
							width={56}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									hideIndicator
									formatter={percentFormatter(reachConfig)}
								/>
							}
						/>
						{segments.map((segment, i) => (
							<Bar
								key={segment.key}
								isAnimationActive={animate}
								dataKey={segment.key}
								stackId="reach"
								radius={i === 0 ? [4, 0, 0, 4] : 0}
							>
								{data.map((d) => (
									<Cell
										key={d.key}
										fill={d.color}
										fillOpacity={segment.opacity}
									/>
								))}
							</Bar>
						))}
						<Bar
							isAnimationActive={animate}
							dataKey="rest"
							stackId="reach"
							fill="var(--muted)"
							radius={[0, 4, 4, 0]}
						/>
					</BarChart>
				</ChartContainer>
				<div>
					{data.map((d) => (
						<p
							key={d.key}
							className="text-right text-sm tabular-nums"
							style={{ lineHeight: `${ROW_HEIGHT}px` }}
						>
							<span className="font-semibold">{d.ratedShare}</span>
							<span className="ml-2 text-muted-foreground">
								{d.accountShare}
							</span>
						</p>
					))}
				</div>
			</div>
			<div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
				<span className="flex items-center gap-1.5">
					<span className="h-2.5 w-2.5 rounded-[2px] bg-foreground" />
					Оцінили
				</span>
				<span className="flex items-center gap-1.5">
					<span className="h-2.5 w-2.5 rounded-[2px] bg-foreground/35" />
					Увійшли, але не оцінили
				</span>
				<span className="flex items-center gap-1.5">
					<span className="h-2.5 w-2.5 rounded-[2px] bg-muted" />
					Не заходили
				</span>
			</div>
		</section>
	);
}

/** A ring for one share, with what it means written beside it. */
function DonutStat({
	part,
	total,
	title,
	caption,
}: Readonly<{ part: number; total: number; title: string; caption: string }>) {
	const config = {
		part: { label: title, color: "var(--primary)" },
		rest: { label: "Решта", color: "var(--muted)" },
	} satisfies ChartConfig;
	const data = [
		{ key: "part", value: part, fill: "var(--color-part)" },
		{ key: "rest", value: total - part, fill: "var(--color-rest)" },
	];
	return (
		<div className="flex items-center gap-4">
			<ChartContainer config={config} className="aspect-square h-24 shrink-0">
				<PieChart>
					<Pie
						isAnimationActive={animate}
						data={data}
						dataKey="value"
						nameKey="key"
						innerRadius="72%"
						outerRadius="100%"
						startAngle={90}
						endAngle={-270}
						strokeWidth={2}
						stroke="var(--card)"
					>
						<Label
							content={({ viewBox }) => {
								if (!viewBox || !("cx" in viewBox)) return null;
								return (
									<text
										x={viewBox.cx}
										y={viewBox.cy}
										textAnchor="middle"
										dominantBaseline="middle"
										className="fill-foreground text-lg font-bold"
									>
										{formatPercent(percent(part, total))}
									</text>
								);
							}}
						/>
					</Pie>
				</PieChart>
			</ChartContainer>
			<div className="min-w-0">
				<p className="font-medium">{title}</p>
				<p className="text-sm text-muted-foreground">{caption}</p>
			</div>
		</div>
	);
}

const histogramConfig = {
	value: { label: "Кількість", color: "var(--primary)" },
} satisfies ChartConfig;

/** Counts per bin; bins are labelled by how many ratings they hold. */
function Histogram({
	title,
	unit,
	bins,
	color,
}: Readonly<{
	title: string;
	unit: string;
	bins: { label: string; value: number }[];
	color: string;
}>) {
	const total = bins.reduce((sum, bin) => sum + bin.value, 0);
	const data = bins.map((bin) => ({
		...bin,
		share: formatPercent(percent(bin.value, total)),
	}));
	return (
		<div>
			<Caption>{title}</Caption>
			<ChartContainer
				config={histogramConfig}
				className="aspect-auto h-52 w-full"
			>
				<BarChart
					data={data}
					margin={{ left: 4, right: 4, top: 20 }}
					barCategoryGap={2}
				>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="label"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
					/>
					<YAxis tickLine={false} axisLine={false} width={32} />
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								hideIndicator
								labelFormatter={(value) => `${value} оцінок`}
								formatter={(value, _, item) => (
									<span className="font-mono tabular-nums">
										{`${formatNumber(Number(value))} ${unit} (${item.payload.share})`}
									</span>
								)}
							/>
						}
					/>
					<Bar
						isAnimationActive={animate}
						dataKey="value"
						fill={color}
						radius={[4, 4, 0, 0]}
					>
						<LabelList
							dataKey="value"
							position="top"
							className="fill-foreground"
							fontSize={11}
						/>
					</Bar>
				</BarChart>
			</ChartContainer>
		</div>
	);
}

/** Groups exact counts into bins like "6–10", given the bins' lower bounds. */
function bin<T extends { n: number }>(
	rows: T[],
	value: (row: T) => number,
	starts: number[],
) {
	return starts.map((start, i) => {
		const end = starts[i + 1];
		const sum = rows
			.filter((r) => r.n >= start && (end === undefined || r.n < end))
			.reduce((acc, r) => acc + value(r), 0);
		let label = `${start}+`;
		if (end !== undefined)
			label = end - start === 1 ? String(start) : `${start}–${end - 1}`;
		return { label, value: sum };
	});
}

export function ReviewsSection({ stats }: Readonly<{ stats: PlatformStats }>) {
	return (
		<section className="space-y-6">
			<SectionTitle
				title="Відгуки"
				description="Як студенти пишуть і читають оцінки"
			/>
			<div className="grid gap-6 sm:grid-cols-3">
				<DonutStat
					part={stats.anonymous}
					total={stats.ratings}
					title="Анонімні"
					caption={`${formatNumber(stats.anonymous)} з ${formatNumber(stats.ratings)} оцінок`}
				/>
				<DonutStat
					part={stats.withComment}
					total={stats.ratings}
					title="З текстом"
					caption={`${formatNumber(stats.withComment)} письмових відгуків`}
				/>
				<DonutStat
					part={stats.upvotes}
					total={stats.votes}
					title="Голоси «корисно»"
					caption={`${formatNumber(stats.upvotes)} з ${formatNumber(stats.votes)} голосів`}
				/>
			</div>
			<div className="grid gap-8 border-t pt-6 lg:grid-cols-2 lg:gap-0 lg:divide-x [&>*]:lg:px-6 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
				<Histogram
					title="Студенти за кількістю своїх оцінок"
					unit="студентів"
					color="var(--primary)"
					bins={bin(
						stats.ratingsPerStudent,
						(r) => r.students,
						[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
					)}
				/>
				<Histogram
					title="Курси за кількістю оцінок"
					unit="курсів"
					color="var(--chart-2)"
					bins={bin(
						stats.ratingsPerCourse,
						(r) => r.courses,
						[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
					)}
				/>
			</div>
		</section>
	);
}
