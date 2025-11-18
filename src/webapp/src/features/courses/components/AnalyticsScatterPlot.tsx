import { useCallback, useMemo, useState } from "react";

import { useNavigate } from "@tanstack/react-router";
import { Minus, Plus, RotateCcw } from "lucide-react";
import {
	ResponsiveContainer,
	ScatterChart,
	Scatter,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	ZAxis,
	Cell,
	Label,
	ReferenceArea,
} from "recharts";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CourseAnalytics } from "@/lib/api/generated";

import { CourseFacultyBadge } from "./CourseFacultyBadge";

const GROUPING_THRESHOLD = 50;
const JITTER_AMOUNT = 0.06;

const FACULTY_COLORS: Record<string, string> = {
	"Факультет інформатики": "hsl(221 83% 53%)",
	"Факультет соціальних наук і соціальних технологій": "hsl(262 83% 58%)",
	"Факультет охорони здоров`я, соціальної роботи і психології": "hsl(330 81% 60%)",
	"Факультет економічних наук": "hsl(142 71% 45%)",
	"Факультет правничих наук": "hsl(35 92% 50%)",
	"Києво-Могилянська школа професійної та неперервної освіти": "hsl(210 100% 45%)",
	"Факультет природничих наук": "hsl(174 72% 40%)",
	"Факультет гуманітарних наук": "hsl(0 84% 60%)",
	"Центр \"Військовий вишкіл ім. гетьмана Петра Конашевича-Сагайдачного в Києво-Могилянській Академії\"": "hsl(45 93% 47%)",
};

type DataPoint = {
	id: string;
	name: string;
	difficulty: number;
	usefulness: number;
	ratingsCount?: number;
	facultyName: string | null | undefined;
	isFacultyGroup?: boolean;
	courseCount?: number;
};

type FacultyGroup = DataPoint & {
	isFacultyGroup: true;
	courseCount: number;
	facultyName: string;
};

interface AnalyticsScatterPlotProps {
	data: CourseAnalytics[];
	isLoading: boolean;
}

type ZoomDomain = {
	x: [number, number];
	y: [number, number];
};

const DEFAULT_DOMAIN: ZoomDomain = {
	x: [0.5, 5.5],
	y: [0.5, 5.5],
};

function getFacultyColor(facultyName: string | null): string {
	if (!facultyName) return "hsl(var(--muted-foreground))";
	return FACULTY_COLORS[facultyName] || "hsl(215 14% 55%)";
}

function applyJitter(value: number): number {
	return value + (Math.random() - 0.5) * JITTER_AMOUNT * 2;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DataPoint }> }) {
	if (active && payload && payload.length) {
		const data = payload[0].payload as DataPoint;
		return (
			<Card className="p-3 shadow-lg border">
				<div className="space-y-2">
					<div className="font-semibold text-sm">
						{data.isFacultyGroup ? `Факультет: ${data.name}` : data.name}
					</div>
					{data.facultyName && (
						<div className="flex items-center gap-2">
							<CourseFacultyBadge facultyName={data.facultyName} />
						</div>
					)}
					<div className="text-xs space-y-1 text-muted-foreground">
						<div>Складність: {data.difficulty.toFixed(2)}</div>
						<div>Корисність: {data.usefulness.toFixed(2)}</div>
						{data.isFacultyGroup ? (
							<div>Курсів: {data.courseCount}</div>
						) : (
							<div>Відгуків: {data.ratingsCount}</div>
						)}
					</div>
				</div>
			</Card>
		);
	}
	return null;
}

export function AnalyticsScatterPlot({
	data,
	isLoading,
}: AnalyticsScatterPlotProps) {
	const navigate = useNavigate();
	const [selectedFaculty, setSelectedFaculty] = useState<string | null>(null);
	const [domain, setDomain] = useState<ZoomDomain>(DEFAULT_DOMAIN);
	const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
	const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
	const [refAreaTop, setRefAreaTop] = useState<number | null>(null);
	const [refAreaBottom, setRefAreaBottom] = useState<number | null>(null);
	const [isSelecting, setIsSelecting] = useState(false);

	const facultyGroups = useMemo(() => {
		const groups = new Map<string, CourseAnalytics[]>();

		for (const course of data) {
			const facultyName = course.faculty_name || "Інше";
			if (!groups.has(facultyName)) {
				groups.set(facultyName, []);
			}
			groups.get(facultyName)?.push(course);
		}

		return groups;
	}, [data]);

	const shouldGroup = data.length > GROUPING_THRESHOLD && !selectedFaculty;

	const scatterData = useMemo(() => {
		if (shouldGroup) {
			const groups: FacultyGroup[] = [];

			for (const [facultyName, courses] of facultyGroups.entries()) {
				if (courses.length === 0) continue;

				const avgDifficulty =
					courses.reduce(
						(sum, c) => sum + (c.avg_difficulty || 0),
						0,
					) / courses.length;
				const avgUsefulness =
					courses.reduce(
						(sum, c) => sum + (c.avg_usefulness || 0),
						0,
					) / courses.length;

				groups.push({
					id: facultyName,
					name: facultyName,
					difficulty: avgDifficulty,
					usefulness: avgUsefulness,
					courseCount: courses.length,
					facultyName,
					isFacultyGroup: true,
				});
			}

			return groups;
		}

		const coursesToShow = selectedFaculty
			? facultyGroups.get(selectedFaculty) || []
			: data;

		return coursesToShow.map((course) => ({
			id: course.id || "",
			name: course.name || "",
			difficulty: applyJitter(course.avg_difficulty || 0),
			usefulness: applyJitter(course.avg_usefulness || 0),
			ratingsCount: course.ratings_count || 0,
			facultyName: course.faculty_name,
			isFacultyGroup: false,
		}));
	}, [shouldGroup, selectedFaculty, facultyGroups, data]);

	const getPointColor = useCallback(
		(point: DataPoint) => {
			const facultyName = point.facultyName || "Інше";
			return getFacultyColor(facultyName);
		},
		[],
	);

	const handleClick = useCallback(
		(point: DataPoint) => {
			if (point.isFacultyGroup) {
				setSelectedFaculty(point.facultyName || null);
			} else {
				navigate({ to: "/courses/$courseId", params: { courseId: point.id } });
			}
		},
		[navigate],
	);

	const handleReset = useCallback(() => {
		setSelectedFaculty(null);
		setDomain(DEFAULT_DOMAIN);
	}, []);

	const zoomIn = useCallback(() => {
		setDomain((prev) => {
			const xRange = prev.x[1] - prev.x[0];
			const yRange = prev.y[1] - prev.y[0];
			const xCenter = (prev.x[0] + prev.x[1]) / 2;
			const yCenter = (prev.y[0] + prev.y[1]) / 2;
			const newXRange = xRange * 0.7;
			const newYRange = yRange * 0.7;
			return {
				x: [xCenter - newXRange / 2, xCenter + newXRange / 2],
				y: [yCenter - newYRange / 2, yCenter + newYRange / 2],
			};
		});
	}, []);

	const zoomOut = useCallback(() => {
		setDomain((prev) => {
			const xRange = prev.x[1] - prev.x[0];
			const yRange = prev.y[1] - prev.y[0];
			const xCenter = (prev.x[0] + prev.x[1]) / 2;
			const yCenter = (prev.y[0] + prev.y[1]) / 2;
			const newXRange = Math.min(xRange * 1.4, 5);
			const newYRange = Math.min(yRange * 1.4, 5);
			return {
				x: [
					Math.max(0.5, xCenter - newXRange / 2),
					Math.min(5.5, xCenter + newXRange / 2),
				],
				y: [
					Math.max(0.5, yCenter - newYRange / 2),
					Math.min(5.5, yCenter + newYRange / 2),
				],
			};
		});
	}, []);

	const resetZoom = useCallback(() => {
		setDomain(DEFAULT_DOMAIN);
	}, []);

	const handleMouseDown = useCallback((state: Record<string, unknown> | null) => {
		const xValue = state?.xValue as number | undefined;
		const yValue = state?.yValue as number | undefined;
		if (xValue !== undefined && yValue !== undefined) {
			setRefAreaLeft(xValue);
			setRefAreaBottom(yValue);
			setIsSelecting(true);
		}
	}, []);

	const handleMouseMove = useCallback((state: Record<string, unknown> | null) => {
		const xValue = state?.xValue as number | undefined;
		const yValue = state?.yValue as number | undefined;
		if (isSelecting && xValue !== undefined && yValue !== undefined) {
			setRefAreaRight(xValue);
			setRefAreaTop(yValue);
		}
	}, [isSelecting]);

	const handleMouseUp = useCallback(() => {
		if (refAreaLeft && refAreaRight && refAreaBottom && refAreaTop) {
			const x1 = Math.min(refAreaLeft, refAreaRight);
			const x2 = Math.max(refAreaLeft, refAreaRight);
			const y1 = Math.min(refAreaBottom, refAreaTop);
			const y2 = Math.max(refAreaBottom, refAreaTop);

			if (x2 - x1 > 0.1 && y2 - y1 > 0.1) {
				setDomain({
					x: [x1, x2],
					y: [y1, y2],
				});
			}
		}

		setRefAreaLeft(null);
		setRefAreaRight(null);
		setRefAreaTop(null);
		setRefAreaBottom(null);
		setIsSelecting(false);
	}, [refAreaLeft, refAreaRight, refAreaBottom, refAreaTop]);

	if (isLoading) {
		return (
			<Card className="p-8">
				<div className="flex items-center justify-center h-[500px]">
					<div className="text-muted-foreground">Завантаження...</div>
				</div>
			</Card>
		);
	}

	if (data.length === 0) {
		return (
			<Card className="p-8">
				<div className="flex flex-col items-center justify-center h-[500px] space-y-4">
					<div className="text-muted-foreground text-lg">
						Немає даних для відображення
					</div>
					<div className="text-sm text-muted-foreground">
						Спробуйте змінити фільтри
					</div>
				</div>
			</Card>
		);
	}

	return (
		<Card className="p-6">
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-semibold">
							Аналітика курсів
						</h2>
						<p className="text-sm text-muted-foreground">
							{shouldGroup
								? "Натисніть на факультет для деталей"
								: selectedFaculty
									? `Курси факультету: ${selectedFaculty}`
									: "Виділіть область для збільшення"}
						</p>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="icon"
							onClick={zoomOut}
							title="Зменшити"
						>
							<Minus className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							onClick={zoomIn}
							title="Збільшити"
						>
							<Plus className="h-4 w-4" />
						</Button>
						<Button
							variant="outline"
							size="icon"
							onClick={resetZoom}
							title="Скинути масштаб"
						>
							<RotateCcw className="h-4 w-4" />
						</Button>
						{selectedFaculty && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleReset}
							>
								← Назад
							</Button>
						)}
					</div>
				</div>

				<div className="w-full h-[500px]">
					<ResponsiveContainer width="100%" height="100%">
						<ScatterChart
							margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
							onMouseDown={handleMouseDown}
							onMouseMove={handleMouseMove}
							onMouseUp={handleMouseUp}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="hsl(var(--border))"
							/>
							<XAxis
								type="number"
								dataKey="difficulty"
								name="Складність"
								domain={domain.x}
								ticks={[1, 2, 3, 4, 5]}
								stroke="hsl(var(--muted-foreground))"
								allowDataOverflow
							>
								<Label
									value="Складність"
									position="bottom"
									offset={40}
									style={{ fill: "hsl(var(--foreground))" }}
								/>
							</XAxis>
							<YAxis
								type="number"
								dataKey="usefulness"
								name="Корисність"
								domain={domain.y}
								ticks={[1, 2, 3, 4, 5]}
								stroke="hsl(var(--muted-foreground))"
								allowDataOverflow
							>
								<Label
									value="Корисність"
									angle={-90}
									position="left"
									offset={40}
									style={{ fill: "hsl(var(--foreground))" }}
								/>
							</YAxis>
							<ZAxis
								type="number"
								dataKey={shouldGroup ? "courseCount" : "ratingsCount"}
								range={[50, 400]}
							/>
							<Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
							<Scatter
								data={scatterData}
								fill="hsl(var(--primary))"
							>
								{scatterData.map((entry) => (
									<Cell
										key={`cell-${entry.id}`}
										fill={getPointColor(entry)}
										fillOpacity={0.6}
										stroke={getPointColor(entry)}
										strokeWidth={2}
										onClick={() => handleClick(entry)}
										style={{ cursor: "pointer" }}
									/>
								))}
							</Scatter>
							{refAreaLeft && refAreaRight && refAreaBottom && refAreaTop && (
								<ReferenceArea
									x1={refAreaLeft}
									x2={refAreaRight}
									y1={refAreaBottom}
									y2={refAreaTop}
									strokeOpacity={0.3}
									fill="hsl(var(--primary))"
									fillOpacity={0.1}
								/>
							)}
						</ScatterChart>
					</ResponsiveContainer>
				</div>

				<div className="flex flex-wrap gap-3 justify-center">
					{Array.from(facultyGroups.keys()).map((facultyName) => (
						<button
							key={facultyName}
							type="button"
							onClick={() => setSelectedFaculty(facultyName)}
							className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors"
						>
							<div
								className="w-3 h-3 rounded-full border-2"
								style={{
									backgroundColor: getFacultyColor(facultyName),
									borderColor: getFacultyColor(facultyName),
									opacity: 0.6,
								}}
							/>
							<span className="text-xs text-muted-foreground">
								{facultyName}
							</span>
						</button>
					))}
				</div>
			</div>
		</Card>
	);
}
