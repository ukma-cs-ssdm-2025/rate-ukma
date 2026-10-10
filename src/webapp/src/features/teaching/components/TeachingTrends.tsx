import { useState } from "react";

import { TrendingDown, TrendingUp } from "lucide-react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	XAxis,
	YAxis,
} from "recharts";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/Chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/ToggleGroup";
import {
	getSemesterDisplay,
	getSemesterTermDisplay,
} from "@/features/courses/courseFormatting";
import { MIN_RATED_TO_SHOW, type TeachingOffering } from "../types";

type Metric = "usefulness" | "difficulty" | "participation";

const METRICS: Record<Metric, { label: string; color: string }> = {
	usefulness: { label: "Корисність", color: "var(--primary)" },
	difficulty: { label: "Складність", color: "var(--chart-5)" },
	participation: { label: "Оцінили", color: "var(--primary)" },
};

// Recharts animates on mount regardless of the OS setting, so honour it here.
const animate = !globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
	.matches;

interface Point {
	readonly id: string;
	readonly label: string;
	readonly year: number;
	readonly term: string;
	readonly value: number | null;
	readonly faculty: number | null;
	readonly rated: number;
	readonly enrolled: number;
}

function toPoints(
	offerings: readonly TeachingOffering[],
	metric: Metric,
): Point[] {
	return [...offerings].reverse().map((offering) => {
		const hidden = offering.rated < MIN_RATED_TO_SHOW;
		const value = {
			usefulness: hidden ? null : offering.avg_usefulness,
			difficulty: hidden ? null : offering.avg_difficulty,
			participation:
				offering.enrolled > 0
					? Math.round((offering.rated / offering.enrolled) * 100)
					: null,
		}[metric];
		const faculty = {
			usefulness: offering.faculty_avg_usefulness,
			difficulty: offering.faculty_avg_difficulty,
			participation: null,
		}[metric];
		return {
			id: offering.id,
			label: getSemesterDisplay(offering.year, offering.term),
			year: offering.year,
			term: offering.term,
			value: value == null ? null : Math.round(value * 10) / 10,
			faculty: faculty == null ? null : Math.round(faculty * 10) / 10,
			rated: offering.rated,
			enrolled: offering.enrolled,
		};
	});
}

/** Term on the first line, year under it, so five semesters fit a phone. */
function SemesterTick({
	x,
	y,
	payload,
	points,
}: Readonly<{
	x?: number;
	y?: number;
	payload?: { value: string };
	points: readonly Point[];
}>) {
	const point = points.find((item) => item.id === payload?.value);
	if (!point) return null;
	return (
		<text x={x} y={y} textAnchor="middle" className="fill-muted-foreground">
			<tspan x={x} dy="0.9em">
				{getSemesterTermDisplay(point.term)}
			</tspan>
			<tspan x={x} dy="1.2em">
				{point.year}
			</tspan>
		</text>
	);
}

const TERM_GENITIVE: Record<string, string> = {
	FALL: "осені",
	SPRING: "весни",
	SUMMER: "літа",
};

/** One short line per change worth noticing, newest semester against the one before. */
function highlights(offerings: readonly TeachingOffering[]) {
	const [current, previous] = offerings;
	if (!current || !previous) return [];
	const since = `${TERM_GENITIVE[previous.term] ?? ""} ${previous.year}`;
	const out: { key: string; up: boolean; text: string }[] = [];
	const shown = (o: TeachingOffering) => o.rated >= MIN_RATED_TO_SHOW;
	if (
		shown(current) &&
		shown(previous) &&
		current.avg_usefulness != null &&
		previous.avg_usefulness != null
	) {
		const delta = current.avg_usefulness - previous.avg_usefulness;
		if (Math.abs(delta) >= 0.1) {
			out.push({
				key: "usefulness",
				up: delta > 0,
				text: `Корисність ${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} від ${since}`,
			});
		}
	}
	if (
		shown(current) &&
		current.avg_usefulness != null &&
		current.faculty_avg_usefulness != null
	) {
		const delta = current.avg_usefulness - current.faculty_avg_usefulness;
		if (Math.abs(delta) >= 0.1) {
			out.push({
				key: "faculty",
				up: delta > 0,
				text: `На ${Math.abs(delta).toFixed(1)} ${delta > 0 ? "вище" : "нижче"} за факультет`,
			});
		}
	}
	const share = (o: TeachingOffering) =>
		o.enrolled > 0 ? (o.rated / o.enrolled) * 100 : 0;
	const participation = Math.round(share(current) - share(previous));
	if (Math.abs(participation) >= 1) {
		out.push({
			key: "participation",
			up: participation > 0,
			text: `Участь ${participation > 0 ? "+" : "−"}${Math.abs(participation)} п.п.`,
		});
	}
	return out;
}

export function TeachingTrends({
	offerings,
	selectedId,
	onSelect,
}: Readonly<{
	offerings: readonly TeachingOffering[];
	selectedId: string;
	onSelect: (id: string) => void;
}>) {
	const [metric, setMetric] = useState<Metric>("usefulness");
	const points = toPoints(offerings, metric);
	const isScore = metric !== "participation";
	const config = {
		value: { label: METRICS[metric].label, color: METRICS[metric].color },
		faculty: { label: "Факультет", color: "var(--muted-foreground)" },
	} satisfies ChartConfig;
	// Changes are read from the picked semester back, not always the newest.
	const notes = highlights(
		offerings.slice(
			Math.max(
				0,
				offerings.findIndex((o) => o.id === selectedId),
			),
		),
	);

	return (
		<Card className="shadow-sm">
			<CardContent className="space-y-4 p-4 sm:p-5">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<h3 className="font-semibold">Динаміка</h3>
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						value={metric}
						onValueChange={(value) => value && setMetric(value as Metric)}
						aria-label="Показник"
					>
						<ToggleGroupItem value="usefulness">Корисність</ToggleGroupItem>
						<ToggleGroupItem value="difficulty">Складність</ToggleGroupItem>
						<ToggleGroupItem value="participation">Участь</ToggleGroupItem>
					</ToggleGroup>
				</div>

				{notes.length > 0 ? (
					<ul className="flex flex-wrap gap-2">
						{notes.map((note) => {
							const Icon = note.up ? TrendingUp : TrendingDown;
							return (
								<li key={note.key}>
									<Badge variant="secondary" className="gap-1.5 py-1">
										<Icon />
										{note.text}
									</Badge>
								</li>
							);
						})}
					</ul>
				) : null}

				<ChartContainer config={config} className="aspect-auto h-56 w-full">
					<LineChart
						data={points}
						margin={{ top: 8, right: 12, bottom: 0, left: -20 }}
						onClick={(state) => {
							const id = state?.activeLabel;
							if (typeof id === "string") onSelect(id);
						}}
					>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="id"
							tickLine={false}
							axisLine={false}
							interval={0}
							padding={{ left: 28, right: 28 }}
							height={40}
							tick={<SemesterTick points={points} />}
						/>
						<YAxis
							domain={isScore ? [1, 5] : [0, 100]}
							ticks={isScore ? [1, 2, 3, 4, 5] : [0, 25, 50, 75, 100]}
							tickFormatter={(value: number) =>
								isScore ? String(value) : `${value}%`
							}
							tickLine={false}
							axisLine={false}
						/>
						<ReferenceLine
							x={selectedId}
							stroke="var(--primary)"
							strokeOpacity={0.12}
							strokeWidth={48}
						/>
						<ChartTooltip
							cursor={false}
							content={
								<ChartTooltipContent
									labelFormatter={(_, payload) => {
										const point = payload?.[0]?.payload as Point | undefined;
										return point
											? `${point.label}, оцінили ${point.rated} з ${point.enrolled}`
											: "";
									}}
									formatter={(value, name) => (
										<div className="flex w-full items-center justify-between gap-3">
											<span className="text-muted-foreground">
												{config[name as keyof typeof config]?.label}
											</span>
											<span className="font-mono font-medium tabular-nums">
												{isScore
													? Number(value).toFixed(1)
													: `${String(value)}%`}
											</span>
										</div>
									)}
								/>
							}
						/>
						<Line
							dataKey="value"
							type="monotone"
							stroke="var(--color-value)"
							strokeWidth={2.5}
							connectNulls
							dot={{ r: 4, fill: "var(--color-value)", strokeWidth: 0 }}
							activeDot={{ r: 6 }}
							isAnimationActive={animate}
						/>
						{isScore ? (
							<Line
								dataKey="faculty"
								type="monotone"
								stroke="var(--color-faculty)"
								strokeDasharray="4 4"
								strokeWidth={1.5}
								dot={false}
								isAnimationActive={animate}
							/>
						) : null}
					</LineChart>
				</ChartContainer>

				{isScore ? (
					<p className="flex items-center gap-2 text-xs text-muted-foreground">
						<span className="w-4 border-t-2 border-dashed border-muted-foreground" />
						Середнє по факультету
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}
