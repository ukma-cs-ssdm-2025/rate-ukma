import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Grid } from "@visx/grid";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Text } from "@visx/text";
import { TooltipWithBounds, useTooltip } from "@visx/tooltip";
import { select } from "d3-selection";
import { zoom as d3Zoom, zoomIdentity } from "d3-zoom";
import type { D3ZoomEvent, ZoomTransform } from "d3-zoom";

import { computeLabelPoints } from "./scatterLabeling";
import type { CourseDataPoint, LabelPoint, Margin } from "./scatterLabeling";
import { ScatterPlotAxes } from "./ScatterPlotAxes";
import { ScatterPlotTooltipCard } from "./ScatterPlotTooltipCard";
import { ScatterPlotZoomControls } from "./ScatterPlotZoomControls";

const margin: Margin = { top: 16, right: 24, bottom: 56, left: 52 };
const EXPLORE_MARGIN: Margin = { top: 76, right: 40, bottom: 60, left: 60 };
const GRID_STROKE_OPACITY = 0.2;
const GRID_STROKE_DASHARRAY = "3,3";
const POINT_HOVER_SCALE = 1.08;
const POINT_DEFAULT_SCALE = 1;
const POINT_HOVER_STROKE_WIDTH = 3.2;
const POINT_DEFAULT_STROKE_WIDTH = 1.5;
const POINT_HOVER_FILL_OPACITY = 1;
const POINT_DEFAULT_FILL_OPACITY = 0.8;
const POINT_TRANSITION_DURATION_MS = 200;
const LABEL_FONT_SIZE = 12;
const LABEL_Y_OFFSET = 4;
const ZOOM_MIN_SCALE = 1;
const ZOOM_MAX_SCALE = 8;

export type ScatterPlotContentProps = Readonly<{
	width: number;
	height: number;
	chartData: CourseDataPoint[];
	variant: "default" | "mini";
	usefulnessDomain: [number, number];
	difficultyDomain: [number, number];
	onCourseClick?: (courseId: string) => void;
}>;

export function ScatterPlotContent({
	width,
	height,
	chartData,
	variant,
	usefulnessDomain,
	difficultyDomain,
	onCourseClick,
}: ScatterPlotContentProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const zoomRef = useRef<ReturnType<
		typeof d3Zoom<SVGSVGElement, unknown>
	> | null>(null);
	const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
	const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

	const plotMargin = variant === "default" ? EXPLORE_MARGIN : margin;
	const innerWidth = width - plotMargin.left - plotMargin.right;
	const innerHeight = height - plotMargin.top - plotMargin.bottom;

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

	useEffect(() => {
		if (!svgRef.current) {
			return;
		}

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
			.on("zoom", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
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
			if (!svg) {
				return;
			}

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
				margin: plotMargin,
				transform,
				xScale,
				yScale,
			}),
		[
			chartData,
			height,
			innerHeight,
			innerWidth,
			plotMargin,
			transform,
			variant,
			width,
			xScale,
			yScale,
		],
	);

	const showLabels = labelPoints.length > 0;

	if (width < 10 || height < 10) {
		return null;
	}

	return (
		<>
			<svg
				ref={svgRef}
				width={width}
				height={height}
				className="cursor-grab bg-[var(--plot-surface,var(--color-background))] active:cursor-grabbing"
				aria-label="Діаграма розподілу дисциплін за корисністю та складністю"
			>
				<Group
					transform={`translate(${plotMargin.left + transform.x}, ${plotMargin.top + transform.y}) scale(${transform.k})`}
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
								stroke={
									isHovered
										? point.color
										: "var(--plot-surface, var(--color-background))"
								}
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

				<ScatterPlotAxes
					plotMargin={plotMargin}
					innerWidth={innerWidth}
					innerHeight={innerHeight}
					xAxisScale={xAxisScale}
					yAxisScale={yAxisScale}
				/>
			</svg>

			{tooltipOpen && tooltipData && (
				<TooltipWithBounds
					top={tooltipTop}
					left={tooltipLeft}
					className="absolute pointer-events-none"
					unstyled
					applyPositionStyle
				>
					<ScatterPlotTooltipCard point={tooltipData} />
				</TooltipWithBounds>
			)}

			{variant === "default" && (
				<ScatterPlotZoomControls svgRef={svgRef} zoomRef={zoomRef} />
			)}
		</>
	);
}
