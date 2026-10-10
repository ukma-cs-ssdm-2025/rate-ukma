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

const scoresConfig = {
	difficulty: { label: "Складність", color: "var(--chart-5)" },
	usefulness: { label: "Корисність", color: "var(--primary)" },
} satisfies ChartConfig;

export function ScoresChart({ stats }: Readonly<{ stats: PlatformStats }>) {
	const total = stats.ratings;
	const data = [1, 2, 3, 4, 5].map((score) => ({
		score: String(score),
		difficulty: percent(stats.difficulty[score - 1], total),
		usefulness: percent(stats.usefulness[score - 1], total),
		difficultyCount: stats.difficulty[score - 1],
		usefulnessCount: stats.usefulness[score - 1],
	}));
	return (
		<section className="space-y-4">
			<div>
				<h2 className="text-lg font-semibold tracking-tight">Як оцінюють</h2>
				<p className="text-sm text-muted-foreground">
					Частка кожної оцінки від 1 до 5
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
								formatter={percentFormatter(scoresConfig)}
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

/** One share out of a whole, with the share written in the hole. */
function Donut({
	part,
	total,
	partLabel,
	restLabel,
}: Readonly<{
	part: number;
	total: number;
	partLabel: string;
	restLabel: string;
}>) {
	const config = {
		part: { label: partLabel, color: "var(--primary)" },
		rest: { label: restLabel, color: "var(--muted)" },
	} satisfies ChartConfig;
	const data = [
		{ key: "part", value: part, fill: "var(--color-part)" },
		{ key: "rest", value: total - part, fill: "var(--color-rest)" },
	];
	return (
		<div className="flex flex-col items-center">
			<ChartContainer config={config} className="aspect-square h-44">
				<PieChart>
					<ChartTooltip
						cursor={false}
						content={<ChartTooltipContent nameKey="key" hideLabel />}
					/>
					<Pie
						isAnimationActive={animate}
						data={data}
						dataKey="value"
						nameKey="key"
						innerRadius={52}
						outerRadius={72}
						strokeWidth={3}
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
									>
										<tspan
											x={viewBox.cx}
											y={viewBox.cy}
											className="fill-foreground text-2xl font-bold"
										>
											{formatPercent(percent(part, total))}
										</tspan>
										<tspan
											x={viewBox.cx}
											y={(viewBox.cy ?? 0) + 20}
											className="fill-muted-foreground text-xs"
										>
											{partLabel}
										</tspan>
									</text>
								);
							}}
						/>
					</Pie>
				</PieChart>
			</ChartContainer>
		</div>
	);
}

const RATER_LABELS: Record<string, string> = {
	"1": "1 курс",
	"2–3": "2–3 курси",
	"4–10": "4–10 курсів",
	"11+": "11+ курсів",
};

const anonymityConfig = {
	difficulty: { label: "Складність", color: "var(--chart-5)" },
	usefulness: { label: "Корисність", color: "var(--primary)" },
} satisfies ChartConfig;

/** Anonymous raters call courses less useful; difficulty barely moves. */
function AnonymityCompare({ stats }: Readonly<{ stats: PlatformStats }>) {
	return (
		<div>
			<p className="text-sm text-muted-foreground">
				Анонімні оцінки суворіші до корисності
			</p>
			<ChartContainer
				config={anonymityConfig}
				className="mt-2 aspect-auto h-44 w-full"
			>
				<BarChart
					data={stats.byAnonymity}
					layout="vertical"
					margin={{ left: 0, right: 40 }}
					barGap={4}
				>
					<XAxis type="number" hide domain={[0, 5]} />
					<YAxis
						type="category"
						dataKey="group"
						tickLine={false}
						axisLine={false}
						width={80}
					/>
					<ChartTooltip cursor={false} content={<ChartTooltipContent />} />
					<ChartLegend content={<ChartLegendContent />} />
					{(["difficulty", "usefulness"] as const).map((key) => (
						<Bar
							key={key}
							isAnimationActive={animate}
							dataKey={key}
							fill={`var(--color-${key})`}
							radius={4}
							barSize={14}
						>
							<LabelList
								dataKey={key}
								position="right"
								formatter={(v: number) => v.toFixed(2)}
								className="fill-foreground"
								fontSize={12}
							/>
						</Bar>
					))}
				</BarChart>
			</ChartContainer>
		</div>
	);
}

const ratersConfig = {
	share: { label: "Студентів", color: "var(--primary)" },
} satisfies ChartConfig;

export function ReviewsSection({ stats }: Readonly<{ stats: PlatformStats }>) {
	const raters = stats.ratersByCount.map((r) => ({
		bucket: r.bucket,
		share: percent(r.students, stats.studentsWhoRated),
		count: r.students,
	}));
	return (
		<section className="space-y-6">
			<SectionTitle
				title="Відгуки"
				description={`Ще ${formatNumber(stats.votes)} разів студенти голосували за чужі відгуки`}
			/>
			<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr]">
				<Donut
					part={stats.anonymous}
					total={stats.ratings}
					partLabel="анонімно"
					restLabel="з іменем"
				/>
				<Donut
					part={stats.withComment}
					total={stats.ratings}
					partLabel="з відгуком"
					restLabel="лише оцінки"
				/>
				<div className="sm:col-span-2 lg:col-span-1">
					<p className="text-sm text-muted-foreground">
						Скільки курсів оцінив кожен студент
					</p>
					<ChartContainer
						config={ratersConfig}
						className="mt-2 aspect-auto h-44 w-full"
					>
						<BarChart data={raters} margin={{ left: 4, right: 12, top: 20 }}>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="bucket"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
							/>
							<YAxis hide />
							<ChartTooltip
								cursor={false}
								content={
									<ChartTooltipContent
										labelFormatter={(value) =>
											RATER_LABELS[String(value)] ?? String(value)
										}
										formatter={percentFormatter(ratersConfig, "count")}
									/>
								}
							/>
							<Bar
								isAnimationActive={animate}
								dataKey="share"
								fill="var(--color-share)"
								radius={[6, 6, 0, 0]}
							>
								<LabelList
									dataKey="share"
									position="top"
									formatter={formatPercent}
									className="fill-foreground"
									fontSize={12}
								/>
							</Bar>
						</BarChart>
					</ChartContainer>
				</div>
			</div>
			<div className="grid gap-8 border-t pt-6 sm:grid-cols-2 lg:grid-cols-[3fr_1fr]">
				<AnonymityCompare stats={stats} />
				<Donut
					part={stats.upvotes}
					total={stats.votes}
					partLabel="«корисно»"
					restLabel="«не корисно»"
				/>
			</div>
		</section>
	);
}

const coverageConfig = {
	share: { label: "Курсів", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** How many rated courses have enough ratings to trust their average. */
export function CoverageChart({ stats }: Readonly<{ stats: PlatformStats }>) {
	const data = stats.coursesByRatings.map((c) => ({
		bucket: `${c.bucket} ${Number.parseInt(c.bucket, 10) < 5 ? "оцінки" : "оцінок"}`,
		share: percent(c.courses, stats.ratedCourses),
		count: c.courses,
	}));
	return (
		<section className="space-y-4">
			<SectionTitle
				title="Наскільки повні дані"
				description={`Частка з ${formatNumber(stats.ratedCourses)} оцінених курсів`}
			/>
			<ChartContainer
				config={coverageConfig}
				className="aspect-auto h-64 w-full"
			>
				<BarChart data={data} layout="vertical" margin={{ left: 0, right: 48 }}>
					<XAxis type="number" hide domain={[0, 100]} />
					<YAxis
						type="category"
						dataKey="bucket"
						tickLine={false}
						axisLine={false}
						width={80}
					/>
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								hideLabel
								formatter={percentFormatter(coverageConfig, "count")}
							/>
						}
					/>
					<Bar
						isAnimationActive={animate}
						dataKey="share"
						fill="var(--color-share)"
						radius={4}
						barSize={18}
						background={{ fill: "var(--muted)", radius: 4 }}
					>
						<LabelList
							dataKey="share"
							position="right"
							formatter={formatPercent}
							className="fill-muted-foreground"
							fontSize={12}
						/>
					</Bar>
				</BarChart>
			</ChartContainer>
		</section>
	);
}
