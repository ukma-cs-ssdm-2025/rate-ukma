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
	difficulty: { label: "Складність", color: "var(--destructive)" },
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

// Recharts wraps label text on spaces, and uk-UA numbers contain one.
function RowLabel(
	props: Readonly<{
		x?: number | string;
		y?: number | string;
		width?: number | string;
		height?: number | string;
		value?: number | string;
	}>,
) {
	const x = Number(props.x ?? 0) + Number(props.width ?? 0) + 6;
	const y = Number(props.y ?? 0) + Number(props.height ?? 0) / 2;
	return (
		<text
			x={x}
			y={y}
			dy="0.35em"
			className="fill-foreground text-xs tabular-nums"
		>
			{props.value}
		</text>
	);
}

/** Horizontal bars with one row per item and the value printed after the bar. */
function RowBars({
	data,
	config,
	rowHeight = 34,
	labelWidth = 56,
	max,
	tooltip,
}: Readonly<{
	data: {
		key: string;
		value: number;
		display: string;
		color?: string;
		tooltip?: string;
	}[];
	config: ChartConfig;
	rowHeight?: number;
	labelWidth?: number;
	max?: number;
	tooltip?: boolean;
}>) {
	return (
		<ChartContainer
			config={config}
			className="aspect-auto w-full"
			style={{ height: data.length * rowHeight }}
		>
			<BarChart
				data={data}
				layout="vertical"
				margin={{ left: 0, right: 84, top: 0, bottom: 0 }}
			>
				<XAxis type="number" hide domain={[0, max ?? "dataMax"]} />
				<YAxis
					type="category"
					dataKey="key"
					tickLine={false}
					axisLine={false}
					width={labelWidth}
				/>
				{tooltip ? (
					<ChartTooltip
						cursor={false}
						content={
							<ChartTooltipContent
								hideIndicator
								formatter={(_, __, item) => (
									<span className="font-mono tabular-nums">
										{item.payload.tooltip}
									</span>
								)}
							/>
						}
					/>
				) : null}
				<Bar
					isAnimationActive={animate}
					dataKey="value"
					radius={4}
					barSize={16}
					fill="var(--primary)"
					background={{ fill: "var(--muted)", radius: 4 }}
				>
					{data.map((d) => (
						<Cell key={d.key} fill={d.color ?? "var(--primary)"} />
					))}
					<LabelList dataKey="display" content={<RowLabel />} />
				</Bar>
			</BarChart>
		</ChartContainer>
	);
}

function Caption({ children }: Readonly<{ children: string }>) {
	return <p className="mb-3 text-sm font-medium">{children}</p>;
}

const rowConfig = {
	value: { label: "Частка", color: "var(--primary)" },
} satisfies ChartConfig;

/** Who the numbers come from: students per faculty, the funnel, course coverage. */
export function ParticipationSection({
	stats,
}: Readonly<{ stats: PlatformStats }>) {
	const faculties = stats.faculties
		.map((f) => {
			const share = percent(f.studentsWhoRated, f.students);
			return {
				key: f.abbr,
				value: share,
				display: formatPercent(share),
				color: f.color,
				tooltip: `${f.studentsWhoRated} з ${formatNumber(f.students)} студентів`,
			};
		})
		.sort((a, b) => b.value - a.value);
	const funnel = [
		{ key: "Усі", value: stats.students, prev: stats.students },
		{ key: "Увійшли", value: stats.studentsSignedIn, prev: stats.students },
		{
			key: "Оцінили",
			value: stats.studentsWhoRated,
			prev: stats.studentsSignedIn,
		},
	].map((step, i) => ({
		key: step.key,
		value: step.value,
		display:
			i === 0
				? formatNumber(step.value)
				: `${formatNumber(step.value)} (${formatPercent(percent(step.value, step.prev))})`,
		tooltip:
			i === 0
				? ""
				: `${formatPercent(percent(step.value, step.prev))} від попереднього кроку`,
	}));
	const coverage = stats.coursesByRatings.map((c) => {
		const share = percent(c.courses, stats.ratedCourses);
		return {
			key: `${c.bucket}`,
			value: share,
			display: `${formatPercent(share)} (${formatNumber(c.courses)})`,
			color: "var(--chart-2)",
			tooltip: `${formatNumber(c.courses)} курсів мають ${c.bucket} оцінок`,
		};
	});
	return (
		<section className="space-y-6">
			<SectionTitle
				title="Хто оцінює"
				description="Наскільки повно оцінки описують університет"
			/>
			<div className="grid gap-8 lg:grid-cols-2 lg:gap-0 lg:divide-x [&>*]:lg:px-6 [&>*:first-child]:lg:pl-0 [&>*:last-child]:lg:pr-0">
				<div>
					<Caption>Частка студентів факультету, що оцінили</Caption>
					<RowBars data={faculties} config={rowConfig} tooltip />
				</div>
				<div className="space-y-6">
					<div>
						<Caption>Студенти</Caption>
						<RowBars data={funnel} config={rowConfig} labelWidth={72} tooltip />
					</div>
					<div>
						<Caption>{`Курси, з ${formatNumber(stats.ratedCourses)} оцінених`}</Caption>
						<RowBars
							data={coverage}
							config={rowConfig}
							labelWidth={72}
							max={100}
							tooltip
						/>
					</div>
				</div>
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

const anonymityConfig = {
	difficulty: { label: "Складність", color: "var(--destructive)" },
	usefulness: { label: "Корисність", color: "var(--primary)" },
} satisfies ChartConfig;

/** Anonymous raters call courses less useful; difficulty barely moves. */
function AnonymityCompare({ stats }: Readonly<{ stats: PlatformStats }>) {
	return (
		<div>
			<Caption>Анонімні оцінки суворіші до корисності</Caption>
			<ChartContainer
				config={anonymityConfig}
				className="aspect-auto h-48 w-full"
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
							barSize={16}
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

const RATER_LABELS: Record<string, string> = {
	"1": "1 курс",
	"2–3": "2–3 курси",
	"4–10": "4–10 курсів",
	"11+": "11+ курсів",
};

const ratersConfig = {
	share: { label: "Студентів", color: "var(--primary)" },
} satisfies ChartConfig;

function RatersChart({ stats }: Readonly<{ stats: PlatformStats }>) {
	const raters = stats.ratersByCount.map((r) => ({
		bucket: r.bucket,
		share: percent(r.students, stats.studentsWhoRated),
		count: r.students,
	}));
	return (
		<div>
			<Caption>Скільки курсів оцінив кожен студент</Caption>
			<ChartContainer config={ratersConfig} className="aspect-auto h-48 w-full">
				<BarChart data={raters} margin={{ left: 4, right: 4, top: 20 }}>
					<CartesianGrid vertical={false} />
					<XAxis
						dataKey="bucket"
						tickLine={false}
						axisLine={false}
						tickMargin={8}
						tickFormatter={(v: string) => RATER_LABELS[v] ?? v}
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
	);
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
				<AnonymityCompare stats={stats} />
				<RatersChart stats={stats} />
			</div>
		</section>
	);
}
