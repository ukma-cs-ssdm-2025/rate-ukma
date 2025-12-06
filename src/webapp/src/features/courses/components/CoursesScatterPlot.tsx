import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AxisBottom, AxisLeft } from "@visx/axis";
import { Grid } from "@visx/grid";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import { scaleLinear } from "@visx/scale";
import { Text } from "@visx/text";
import { TooltipWithBounds, useTooltip } from "@visx/tooltip";
import { select } from "d3-selection";
import { zoom as d3Zoom, type ZoomTransform, zoomIdentity } from "d3-zoom";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { Spinner } from "@/components/ui/Spinner";
import type {
	AnalyticsListParams,
	CoursesListParams,
} from "@/lib/api/generated";
import {
	useAnalyticsList,
	useCoursesFilterOptionsRetrieve,
} from "@/lib/api/generated";
import { getFacultyColors, getFacultyHexColor } from "@/lib/faculty-colors";
import {
	type CourseDataPoint,
	computeLabelPoints,
	type LabelPoint,
	type Margin,
} from "./scatterLabeling";
import {
	DIFFICULTY_RANGE,
	getDifficultyTone,
	getUsefulnessTone,
	USEFULNESS_RANGE,
} from "../courseFormatting";

const PLOT_LOADING_MESSAGES = [
	{
		title: "Розкладаємо координатну сітку…",
		description: "Підтягуємо курси в потрібні квадранти.",
	},
	{
		title: "Згущуємо точки на графіку 🫧",
		description: "Чекаємо, поки дані зберуться в хмарку.",
	},
	{
		title: "Підписуємо найголовніші курси ✍️",
		description: "Вирішуємо, хто отримає свою мітку першим.",
	},
	{
		title: "Обчислюємо складність корисності…",
		description: "Курси вже розміщуються по осях.",
	},
	{
		title: "Наводимо красу на візуалізації ✨",
		description: "Ще мить — і графік буде готовий.",
	},
] as const;

function normalizeAnalyticsFilters(
	filters: Readonly<CoursesListParams>,
): AnalyticsListParams {
	const {
		name,
		faculty,
		department,
		instructor,
		speciality,
		semester_term,
		semester_year,
		avg_difficulty_min,
		avg_difficulty_max,
		avg_usefulness_min,
		avg_usefulness_max,
		avg_difficulty_order,
		avg_usefulness_order,
		page_size,
		type_kind,
	} = filters;

	return {
		name,
		faculty,
		department,
		instructor,
		speciality,
		semester_term,
		semester_year,
		avg_difficulty_min,
		avg_difficulty_max,
		avg_usefulness_min,
		avg_usefulness_max,
		avg_difficulty_order,
		avg_usefulness_order,
		page_size: page_size ?? 500,
		type_kind,
	};
}

type LoadingMessage = (typeof PLOT_LOADING_MESSAGES)[number];

function getRandomLoadingMessage(): LoadingMessage {
	const index = Math.floor(Math.random() * PLOT_LOADING_MESSAGES.length);
	return PLOT_LOADING_MESSAGES[index];
}

function computeDomain(
	min: number | undefined,
	max: number | undefined,
	range: [number, number],
	padding = 0.15,
): [number, number] {
	const clampedMin = Math.max(range[0], min ?? range[0]);
	const clampedMax = Math.min(range[1], max ?? range[1]);
	if (clampedMin >= clampedMax) {
		return range;
	}
	return [
		Math.max(range[0], clampedMin - padding),
		Math.min(range[1], clampedMax + padding),
	];
}

function ScatterPlotLoader({ message }: Readonly<{ message: LoadingMessage }>) {
	return (
		<div className="absolute inset-0 grid place-items-center">
			<div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
				<Spinner className="text-muted-foreground" />
				<div className="space-y-1">
					<div className="text-sm font-semibold text-foreground">
						{message.title}
					</div>
					<div className="text-xs text-muted-foreground/90">
						{message.description}
					</div>
				</div>
			</div>
		</div>
	);
}

const margin: Margin = { top: 20, right: 20, bottom: 60, left: 60 };

function FacultyBadge({ name }: Readonly<{ name: string }>) {
	const colors = getFacultyColors(name);
	return (
		<Badge
			variant="secondary"
			className={[
				"font-medium text-xs px-2 py-0.5 border",
				colors.bg,
				colors.text,
				colors.border,
			].join(" ")}
			title={name}
		>
			{name}
		</Badge>
	);
}

type ScatterPlotContentProps = Readonly<{
	width: number;
	height: number;
	chartData: CourseDataPoint[];
	variant: "default" | "mini";
	usefulnessDomain: [number, number];
	difficultyDomain: [number, number];
	onCourseClick?: (courseId: string) => void;
	forceShowAllLabels?: boolean;
}>;

function ScatterPlotState({
	title,
	description,
}: Readonly<{
	title: string;
	description: string;
}>) {
	return (
		<div className="w-full h-full relative flex items-center justify-center">
			<div className="text-center space-y-2">
				<h3 className="text-lg font-semibold">{title}</h3>
				<p className="text-sm text-muted-foreground">{description}</p>
			</div>
		</div>
	);
}

function ScatterPlotContent({
	width,
	height,
	chartData,
	variant,
	usefulnessDomain,
	difficultyDomain,
	onCourseClick,
	forceShowAllLabels = false,
}: ScatterPlotContentProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const zoomRef = useRef<ReturnType<
		typeof d3Zoom<SVGSVGElement, unknown>
	> | null>(null);
	const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
	const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

	const innerWidth = width - margin.left - margin.right;
	const innerHeight = height - margin.top - margin.bottom;

	const xScale = useMemo(
		() =>
			scaleLinear({
				domain: usefulnessDomain,
				range: [0, innerWidth],
			}),
		[innerWidth, usefulnessDomain],
	);

	const yScale = useMemo(
		() =>
			scaleLinear({
				domain: difficultyDomain,
				range: [innerHeight, 0],
			}),
		[difficultyDomain, innerHeight],
	);

	// Create rescaled versions for axes that respond to zoom
	const xAxisScale = useMemo(
		() => transform.rescaleX(xScale),
		[transform, xScale],
	);

	const yAxisScale = useMemo(
		() => transform.rescaleY(yScale),
		[transform, yScale],
	);

	const {
		tooltipData,
		tooltipLeft,
		tooltipTop,
		tooltipOpen,
		showTooltip,
		hideTooltip,
	} = useTooltip<CourseDataPoint>();

	// Setup zoom behavior
	useEffect(() => {
		if (!svgRef.current) return;

		const svg = select(svgRef.current);
		const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
			.scaleExtent([1, 8])
			.extent([
				[0, 0],
				[width, height],
			])
			.translateExtent([
				[0, 0],
				[width, height],
			])
			.on("zoom", (event) => {
				setTransform(event.transform);
			});

		zoomRef.current = zoomBehavior;

		svg.call(zoomBehavior);

		return () => {
			svg.on(".zoom", null);
			zoomRef.current = null;
		};
	}, [width, height]);

	const handleMouseMove = useCallback(
		(event: React.MouseEvent<SVGCircleElement>, point: CourseDataPoint) => {
			const svg = svgRef.current;
			if (!svg) return;

			const rect = svg.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;
			const mouseY = event.clientY - rect.top;

			showTooltip({
				tooltipData: point,
				tooltipLeft: mouseX,
				tooltipTop: mouseY,
			});
		},
		[showTooltip],
	);

	const labelPoints: LabelPoint[] = useMemo(
		() =>
			computeLabelPoints({
				chartData,
				variant,
				width,
				height,
				innerWidth,
				innerHeight,
				margin,
				transform,
				xScale,
				yScale,
				forceShowAllLabels,
			}),
		[
			chartData,
			height,
			innerHeight,
			innerWidth,
			transform,
			forceShowAllLabels,
			variant,
			width,
			xScale,
			yScale,
		],
	);

	const showLabels = labelPoints.length > 0;

	if (width < 10 || height < 10) return null;

	return (
		<>
			<svg
				ref={svgRef}
				width={width}
				height={height}
				className="bg-background cursor-grab active:cursor-grabbing"
				aria-labelledby="courses-scatterplot-title"
			>
				<title id="courses-scatterplot-title">
					Діаграма розподілу курсів за корисністю та складністю
				</title>
				<Group
					transform={`translate(${margin.left + transform.x}, ${margin.top + transform.y}) scale(${transform.k})`}
				>
					<Grid
						xScale={xScale}
						yScale={yScale}
						width={innerWidth}
						height={innerHeight}
						stroke="hsl(var(--border))"
						strokeOpacity={0.3}
						strokeDasharray="3,3"
					/>

					{chartData.map((point) => {
						const cx = xScale(point.x);
						const cy = yScale(point.y);
						const isHovered = hoveredPointId === point.id;
						const scale = isHovered ? 1.08 : 1;
						const strokeWidth = isHovered ? 3.2 : 1.5;
						return (
							// biome-ignore lint/a11y/useSemanticElements: Interactive SVG point cannot be a native button element
							<circle
								key={point.id}
								cx={cx}
								cy={cy}
								r={point.radius}
								fill={point.color}
								fillOpacity={isHovered ? 1 : 0.8}
								stroke={isHovered ? point.color : "hsl(var(--background))"}
								strokeWidth={strokeWidth}
								onMouseEnter={() => setHoveredPointId(point.id)}
								onMouseMove={(event) => handleMouseMove(event, point)}
								onMouseLeave={() => {
									setHoveredPointId(null);
									hideTooltip();
								}}
								onClick={() => onCourseClick?.(point.id)}
								onKeyDown={(event) => {
									if (event.key === "Enter" || event.key === " ") {
										event.preventDefault();
										onCourseClick?.(point.id);
									}
								}}
								onFocus={() => setHoveredPointId(point.id)}
								onBlur={() => {
									setHoveredPointId(null);
									hideTooltip();
								}}
								tabIndex={0}
								role="button"
								style={{
									cursor: "pointer",
									transform: `scale(${scale})`,
									transformOrigin: `${cx}px ${cy}px`,
									transition:
										"transform 200ms ease, stroke-width 200ms ease, fill-opacity 200ms ease",
									outline: "none",
								}}
								aria-label={`${point.name}, ${point.facultyName}`}
							/>
						);
					})}

					{/* Labels - density + importance gated */}
					{showLabels &&
						labelPoints.map(({ point, cx, cy }) => (
							<Text
								key={`label-${point.id}`}
								x={cx}
								y={cy - point.radius - 4}
								fontSize={11 / transform.k}
								fill="hsl(var(--foreground))"
								textAnchor="middle"
								style={{ pointerEvents: "none", userSelect: "none" }}
							>
								{point.name}
							</Text>
						))}
				</Group>

				<Group left={margin.left} top={margin.top}>
					<AxisBottom
						top={innerHeight}
						scale={xAxisScale}
						numTicks={5}
						stroke="hsl(var(--muted-foreground))"
						tickStroke="hsl(var(--muted-foreground))"
						tickLabelProps={() => ({
							fill: "hsl(var(--muted-foreground))",
							fontSize: 12,
							textAnchor: "middle",
						})}
						label="Корисність"
						labelProps={{
							fill: "hsl(var(--foreground))",
							fontSize: 14,
							fontWeight: 500,
							textAnchor: "middle",
						}}
					/>
					<AxisLeft
						scale={yAxisScale}
						numTicks={5}
						stroke="hsl(var(--muted-foreground))"
						tickStroke="hsl(var(--muted-foreground))"
						tickLabelProps={() => ({
							fill: "hsl(var(--muted-foreground))",
							fontSize: 12,
							textAnchor: "end",
							dy: "0.33em",
						})}
						label="Складність"
						labelProps={{
							fill: "hsl(var(--foreground))",
							fontSize: 14,
							fontWeight: 500,
							textAnchor: "middle",
						}}
					/>
				</Group>
			</svg>

			{tooltipOpen && tooltipData && (
				<TooltipWithBounds
					top={tooltipTop}
					left={tooltipLeft}
					className="absolute pointer-events-none"
					unstyled
					applyPositionStyle
				>
					<div className="bg-card border border-border rounded-lg shadow-lg p-3 text-sm max-w-lg">
						<div className="flex flex-wrap items-start gap-2 mb-2">
							<div className="font-semibold text-foreground leading-tight">
								{tooltipData.name}
							</div>
							<FacultyBadge name={tooltipData.facultyName} />
						</div>
						<div className="space-y-1 text-muted-foreground">
							<div className="flex justify-between gap-4">
								<span>Корисність:</span>
								<span
									className={`font-medium ${getUsefulnessTone(tooltipData.x)}`}
								>
									{tooltipData.x.toFixed(2)}
								</span>
							</div>
							<div className="flex justify-between gap-4">
								<span>Складність:</span>
								<span
									className={`font-medium ${getDifficultyTone(tooltipData.y)}`}
								>
									{tooltipData.y.toFixed(2)}
								</span>
							</div>
							<div className="flex justify-between gap-4">
								<span>Відгуків:</span>
								<span className="font-medium text-foreground">
									{tooltipData.ratingsCount}
								</span>
							</div>
						</div>
					</div>
				</TooltipWithBounds>
			)}

			{variant === "default" && (
				<div className="absolute bottom-16 right-3">
					<ButtonGroup
						orientation="vertical"
						aria-label="Керування масштабом графіка"
						className="rounded-md border border-border bg-transparent shadow-none backdrop-blur"
					>
						<Button
							variant="ghost"
							size="sm"
							className="h-10 w-10 shadow-none"
							onClick={() => {
								if (!zoomRef.current || !svgRef.current) return;
								zoomRef.current.scaleBy(select(svgRef.current), 1.25);
							}}
							aria-label="Збільшити"
						>
							+
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-10 w-10 shadow-none"
							onClick={() => {
								if (!zoomRef.current || !svgRef.current) return;
								zoomRef.current.scaleBy(select(svgRef.current), 0.8);
							}}
							aria-label="Зменшити"
						>
							-
						</Button>
					</ButtonGroup>
				</div>
			)}
		</>
	);
}

export function CoursesScatterPlot({
	filters,
	variant = "default",
	forceShowAllLabels = false,
}: Readonly<{
	filters: CoursesListParams;
	variant?: "default" | "mini";
	forceShowAllLabels?: boolean;
}>) {
	const navigate = useNavigate();

	const usefulnessDomain = useMemo<[number, number]>(() => {
		return computeDomain(
			filters.avg_usefulness_min,
			filters.avg_usefulness_max,
			USEFULNESS_RANGE,
		);
	}, [filters.avg_usefulness_max, filters.avg_usefulness_min]);

	const difficultyDomain = useMemo<[number, number]>(() => {
		return computeDomain(
			filters.avg_difficulty_min,
			filters.avg_difficulty_max,
			DIFFICULTY_RANGE,
		);
	}, [filters.avg_difficulty_max, filters.avg_difficulty_min]);

	const analyticsFilters = useMemo(
		() => normalizeAnalyticsFilters(filters),
		[filters],
	);

	const { data, isLoading, isError } = useAnalyticsList(analyticsFilters, {
		query: {
			placeholderData: keepPreviousData,
		},
	});
	const loadingMessage = useMemo(() => getRandomLoadingMessage(), []);

	const filterOptionsQuery = useCoursesFilterOptionsRetrieve();
	const faculties = filterOptionsQuery.data?.faculties ?? [];

	const facultyColorMap = useMemo(() => {
		const map = new Map<string, string>();
		for (const faculty of faculties) {
			map.set(faculty.name, getFacultyHexColor(faculty.name));
		}
		return map;
	}, [faculties]);

	const chartData: CourseDataPoint[] = useMemo(() => {
		const analytics = data ?? [];

		return analytics
			.filter(
				(course) =>
					course.avg_usefulness != null &&
					course.avg_difficulty != null &&
					course.ratings_count != null &&
					course.ratings_count > 0,
			)
			.map((course) => {
				const ratingsCount = course.ratings_count ?? 0;
				const radius = Math.max(3, Math.min(Math.sqrt(ratingsCount) * 2, 30));

				return {
					id: course.id ?? "unknown",
					name: course.name ?? "Курс",
					x: course.avg_usefulness ?? USEFULNESS_RANGE[0],
					y: course.avg_difficulty ?? DIFFICULTY_RANGE[0],
					radius,
					color: facultyColorMap.get(course.faculty_name ?? "") ?? "#6b7280",
					facultyName: course.faculty_name ?? "Інше",
					ratingsCount,
				};
			});
	}, [data, facultyColorMap]);

	const handleCourseClick = useCallback(
		(courseId: string) => {
			navigate({ to: "/courses/$courseId", params: { courseId } });
		},
		[navigate],
	);

	if (isLoading) {
		return (
			<div className="relative h-full w-full overflow-hidden bg-card">
				<ScatterPlotLoader message={loadingMessage} />
			</div>
		);
	}

	if (isError) {
		return (
			<ScatterPlotState
				title="Не вдалося завантажити діаграму"
				description="Спробуйте оновити сторінку"
			/>
		);
	}

	if (chartData.length === 0) {
		return (
			<ScatterPlotState
				title="Немає даних"
				description="Змініть фільтри, щоб побачити курси"
			/>
		);
	}

	return (
		<div className="w-full h-full relative">
			<ParentSize>
				{({ width, height }) => (
					<ScatterPlotContent
						width={width}
						height={height}
						chartData={chartData}
						variant={variant}
						usefulnessDomain={usefulnessDomain}
						difficultyDomain={difficultyDomain}
						onCourseClick={handleCourseClick}
						forceShowAllLabels={forceShowAllLabels}
					/>
				)}
			</ParentSize>
		</div>
	);
}
