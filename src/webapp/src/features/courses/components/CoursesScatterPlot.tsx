import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
	padding = DOMAIN_PADDING,
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

// Axis styling constants
const AXIS_TICK_FONT_SIZE = 12;
const AXIS_LABEL_FONT_SIZE = 14;
const AXIS_LABEL_FONT_WEIGHT = 500;

// Axis positioning constants
const AXIS_BG_TOP_EXTENSION = 20; // Extension above the Y-axis
const X_AXIS_TICK_Y_OFFSET = 20; // Distance of tick labels from axis
const X_AXIS_LABEL_Y_OFFSET = 45; // Distance of axis label from axis
const Y_AXIS_TICK_X_OFFSET = 10; // Distance of tick labels from axis
const Y_AXIS_LABEL_X_OFFSET = 40; // Distance of axis label from axis

// Grid styling constants
const GRID_STROKE_OPACITY = 0.3;
const GRID_STROKE_DASHARRAY = "3,3";

// Point styling constants
const POINT_HOVER_SCALE = 1.08;
const POINT_DEFAULT_SCALE = 1;
const POINT_HOVER_STROKE_WIDTH = 3.2;
const POINT_DEFAULT_STROKE_WIDTH = 1.5;
const POINT_HOVER_FILL_OPACITY = 1;
const POINT_DEFAULT_FILL_OPACITY = 0.8;
const POINT_TRANSITION_DURATION_MS = 200;

// Label styling constants
const LABEL_FONT_SIZE = 11;
const LABEL_Y_OFFSET = 4; // Distance from point radius

// Zoom constants
const ZOOM_MIN_SCALE = 1;
const ZOOM_MAX_SCALE = 8;
const ZOOM_IN_FACTOR = 1.25;
const ZOOM_OUT_FACTOR = 0.8;

// Point radius constants
const POINT_MIN_RADIUS = 3;
const POINT_MAX_RADIUS = 30;
const POINT_RADIUS_MULTIPLIER = 2;

// Axis ticks
const NUM_AXIS_TICKS = 5;

const DOMAIN_PADDING = 0.15;
const TOOLTIP_DECIMAL_PLACES = 2;

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
			.scaleExtent([ZOOM_MIN_SCALE, ZOOM_MAX_SCALE])
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
				aria-label="Діаграма розподілу курсів за корисністю та складністю"
				role="img"
			>
				<Group
					transform={`translate(${margin.left + transform.x}, ${margin.top + transform.y}) scale(${transform.k})`}
				>
					<Grid
						xScale={xScale}
						yScale={yScale}
						width={innerWidth}
						height={innerHeight}
						stroke="var(--color-border)"
						strokeOpacity={GRID_STROKE_OPACITY}
						strokeDasharray={GRID_STROKE_DASHARRAY}
					/>

					{chartData.map((point) => {
						const cx = xScale(point.x);
						const cy = yScale(point.y);
						const isHovered = hoveredPointId === point.id;
						const scale = isHovered ? POINT_HOVER_SCALE : POINT_DEFAULT_SCALE;
						const strokeWidth = isHovered
							? POINT_HOVER_STROKE_WIDTH
							: POINT_DEFAULT_STROKE_WIDTH;
						return (
							// biome-ignore lint/a11y/useSemanticElements: Interactive SVG point cannot be a native button element
							<circle
								key={point.id}
								cx={cx}
								cy={cy}
								r={point.radius}
								fill={point.color}
								fillOpacity={
									isHovered
										? POINT_HOVER_FILL_OPACITY
										: POINT_DEFAULT_FILL_OPACITY
								}
								stroke={isHovered ? point.color : "var(--color-background)"}
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
									transition: `transform ${POINT_TRANSITION_DURATION_MS}ms ease, stroke-width ${POINT_TRANSITION_DURATION_MS}ms ease, fill-opacity ${POINT_TRANSITION_DURATION_MS}ms ease`,
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
								y={cy - point.radius - LABEL_Y_OFFSET}
								fontSize={LABEL_FONT_SIZE / transform.k}
								fill="var(--color-foreground)"
								textAnchor="middle"
								style={{ pointerEvents: "none", userSelect: "none" }}
							>
								{point.name}
							</Text>
						))}
				</Group>

				<Group left={margin.left} top={margin.top}>
					{/* X-axis background bar */}
					<rect
						x={-margin.left}
						y={innerHeight}
						width={innerWidth + margin.left}
						height={margin.bottom}
						fill="var(--color-background)"
					/>

					{/* Y-axis background bar */}
					<rect
						x={-margin.left}
						y={-AXIS_BG_TOP_EXTENSION}
						width={margin.left}
						height={innerHeight + AXIS_BG_TOP_EXTENSION}
						fill="var(--color-background)"
					/>

					{/* X-axis tick labels */}
					{xAxisScale.ticks(NUM_AXIS_TICKS).map((tick) => {
						const x = xAxisScale(tick) ?? 0;
						return (
							<text
								key={`x-tick-${tick}`}
								x={x}
								y={innerHeight + X_AXIS_TICK_Y_OFFSET}
								fill="var(--color-muted-foreground)"
								fontSize={AXIS_TICK_FONT_SIZE}
								textAnchor="middle"
								dominantBaseline="middle"
							>
								{tick}
							</text>
						);
					})}

					{/* Y-axis tick labels */}
					{yAxisScale.ticks(NUM_AXIS_TICKS).map((tick) => {
						const y = yAxisScale(tick) ?? 0;
						return (
							<text
								key={`y-tick-${tick}`}
								x={-Y_AXIS_TICK_X_OFFSET}
								y={y}
								fill="var(--color-muted-foreground)"
								fontSize={AXIS_TICK_FONT_SIZE}
								textAnchor="end"
								dominantBaseline="middle"
							>
								{tick}
							</text>
						);
					})}

					{/* X-axis label */}
					<text
						x={innerWidth / 2}
						y={innerHeight + X_AXIS_LABEL_Y_OFFSET}
						fill="var(--color-foreground)"
						fontSize={AXIS_LABEL_FONT_SIZE}
						fontWeight={AXIS_LABEL_FONT_WEIGHT}
						textAnchor="middle"
						dominantBaseline="middle"
					>
						Корисність
					</text>

					{/* Y-axis label */}
					<text
						x={-Y_AXIS_LABEL_X_OFFSET}
						y={innerHeight / 2}
						fill="var(--color-foreground)"
						fontSize={AXIS_LABEL_FONT_SIZE}
						fontWeight={AXIS_LABEL_FONT_WEIGHT}
						textAnchor="middle"
						dominantBaseline="middle"
						transform={`rotate(-90, -${Y_AXIS_LABEL_X_OFFSET}, ${innerHeight / 2})`}
					>
						Складність
					</text>
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
									{tooltipData.x.toFixed(TOOLTIP_DECIMAL_PLACES)}
								</span>
							</div>
							<div className="flex justify-between gap-4">
								<span>Складність:</span>
								<span
									className={`font-medium ${getDifficultyTone(tooltipData.y)}`}
								>
									{tooltipData.y.toFixed(TOOLTIP_DECIMAL_PLACES)}
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
								zoomRef.current.scaleBy(select(svgRef.current), ZOOM_IN_FACTOR);
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
								zoomRef.current.scaleBy(
									select(svgRef.current),
									ZOOM_OUT_FACTOR,
								);
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
				const radius = Math.max(
					POINT_MIN_RADIUS,
					Math.min(
						Math.sqrt(ratingsCount) * POINT_RADIUS_MULTIPLIER,
						POINT_MAX_RADIUS,
					),
				);

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
