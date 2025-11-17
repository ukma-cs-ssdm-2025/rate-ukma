import { useCallback, useMemo, useState } from "react";

import { useNavigate } from "@tanstack/react-router";
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
} from "recharts";

import { Card } from "@/components/ui/Card";
import type { CourseAnalytics } from "@/lib/api/generated";

import { CourseFacultyBadge } from "./CourseFacultyBadge";

const GROUPING_THRESHOLD = 50;
const JITTER_AMOUNT = 0.08;

const FACULTY_COLORS: Record<string, string> = {
	"Факультет інформатики": "hsl(var(--chart-1))",
	"Факультет соціальних наук і соціальних технологій": "hsl(var(--chart-2))",
	"Факультет охорони здоров`я, соціальної роботи і психології": "hsl(var(--chart-3))",
	"Факультет економічних наук": "hsl(var(--chart-4))",
	"Факультет правничих наук": "hsl(var(--chart-5))",
	"Києво-Могилянська школа професійної та неперервної освіти": "hsl(210 100% 45%)",
	"Факультет природничих наук": "hsl(140 60% 45%)",
	"Факультет гуманітарних наук": "hsl(30 90% 50%)",
	"Центр \"Військовий вишкіл ім. гетьмана Петра Конашевича-Сагайдачного в Києво-Могилянській Академії\"": "hsl(0 70% 50%)",
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

function getFacultyColor(facultyName: string | null): string {
	if (!facultyName) return "hsl(var(--muted-foreground))";
	return FACULTY_COLORS[facultyName] || "hsl(var(--muted-foreground))";
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
			let facultyIndex = 0;

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

				facultyIndex++;
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
	}, []);

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
									: "Натисніть на курс для деталей"}
						</p>
					</div>
					{selectedFaculty && (
						<button
							type="button"
							onClick={handleReset}
							className="text-sm text-primary hover:underline"
						>
							← Повернутися до факультетів
						</button>
					)}
				</div>

				<div className="w-full h-[500px]">
					<ResponsiveContainer width="100%" height="100%">
						<ScatterChart
							margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="hsl(var(--border))"
							/>
							<XAxis
								type="number"
								dataKey="difficulty"
								name="Складність"
								domain={[0.5, 5.5]}
								ticks={[1, 2, 3, 4, 5]}
								stroke="hsl(var(--muted-foreground))"
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
								domain={[0.5, 5.5]}
								ticks={[1, 2, 3, 4, 5]}
								stroke="hsl(var(--muted-foreground))"
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
								range={[100, 1000]}
							/>
							<Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
							<Scatter
								data={scatterData}
								fill="hsl(var(--primary))"
								style={{ cursor: "pointer" }}
							>
								{scatterData.map((entry) => (
									<Cell
										key={`cell-${entry.id}`}
										fill={getPointColor(entry)}
										onClick={() => handleClick(entry)}
										style={{ cursor: "pointer" }}
									/>
								))}
							</Scatter>
						</ScatterChart>
					</ResponsiveContainer>
				</div>

				<div className="flex flex-wrap gap-3 justify-center">
					{Array.from(facultyGroups.keys()).map((facultyName) => (
						<div key={facultyName} className="flex items-center gap-2">
							<div
								className="w-3 h-3 rounded-full"
								style={{
									backgroundColor: getFacultyColor(facultyName),
								}}
							/>
							<span className="text-xs text-muted-foreground">
								{facultyName}
							</span>
						</div>
					))}
				</div>
			</div>
		</Card>
	);
}
