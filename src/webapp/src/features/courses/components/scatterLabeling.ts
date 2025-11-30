import type { ZoomTransform } from "d3-zoom";

export type CourseDataPoint = {
	id: string;
	name: string;
	x: number;
	y: number;
	radius: number;
	color: string;
	facultyName: string;
	ratingsCount: number;
};

export type LabelPoint = {
	point: CourseDataPoint;
	cx: number;
	cy: number;
};

export type Margin = Readonly<{
	top: number;
	right: number;
	bottom: number;
	left: number;
}>;

type LinearScale = (value: number) => number;

// Zoom level after which labels may start appearing.
export const LABEL_ZOOM_THRESHOLD = 2;
// If there are few points or plenty of canvas space per point, show many labels.
export const SPARSE_POINT_THRESHOLD = 40;
export const SPARSE_AREA_PER_POINT = 12000;
// Spacing for dense vs sparse to reduce overlap.
export const MIN_LABEL_BASE_DISTANCE_DENSE = 12;
export const MIN_LABEL_BASE_DISTANCE_SPARSE = 8;
export const MIN_LABEL_BASE_DISTANCE_DENSE_PX = 36;
export const MIN_LABEL_BASE_DISTANCE_SPARSE_PX = 18;
export const DENSE_LABEL_SUPPRESSION_COUNT = 140;
export const AUTO_LABEL_LIMIT = 60;

export function computeLabelPoints(params: {
	chartData: CourseDataPoint[];
	variant: "default" | "mini";
	width: number;
	height: number;
	innerWidth: number;
	innerHeight: number;
	margin: Margin;
	transform: ZoomTransform;
	xScale: LinearScale;
	yScale: LinearScale;
	forceShowAllLabels?: boolean;
}): LabelPoint[] {
	const {
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
		forceShowAllLabels = false,
	} = params;

	if (variant === "mini") {
		return [];
	}

	if (width < 10 || height < 10) return [];

	const sortedByImportance = [...chartData].sort((a, b) => b.radius - a.radius);
	if (sortedByImportance.length === 0) return [];

	const isDenseDataset =
		sortedByImportance.length >= DENSE_LABEL_SUPPRESSION_COUNT;

	const areaPerPoint =
		(innerWidth * innerHeight) / Math.max(1, sortedByImportance.length);
	const sparseByCount = sortedByImportance.length <= 20;
	const sparseByArea = areaPerPoint > 20000;
	const canShowWithoutZoom = sparseByCount && sparseByArea;

	if (
		!forceShowAllLabels &&
		!canShowWithoutZoom &&
		transform.k < LABEL_ZOOM_THRESHOLD
	) {
		return [];
	}

	if (
		!forceShowAllLabels &&
		isDenseDataset &&
		transform.k < LABEL_ZOOM_THRESHOLD + 0.5
	) {
		return [];
	}

	const minDistance = forceShowAllLabels
		? Math.max(
				MIN_LABEL_BASE_DISTANCE_SPARSE,
				MIN_LABEL_BASE_DISTANCE_SPARSE_PX / Math.max(1, transform.k),
			)
		: canShowWithoutZoom
			? Math.max(
					MIN_LABEL_BASE_DISTANCE_SPARSE,
					MIN_LABEL_BASE_DISTANCE_SPARSE_PX / Math.max(1, transform.k),
				)
			: Math.max(
					MIN_LABEL_BASE_DISTANCE_DENSE,
					MIN_LABEL_BASE_DISTANCE_DENSE_PX / Math.max(1, transform.k),
				);

	const maxLabels = forceShowAllLabels
		? Number.POSITIVE_INFINITY
		: AUTO_LABEL_LIMIT;

	const placed: LabelPoint[] = [];

	for (const point of sortedByImportance) {
		if (placed.length >= maxLabels) break;

		const cx = xScale(point.x);
		const cy = yScale(point.y);
		const screenX = margin.left + transform.applyX(cx);
		const screenY = margin.top + transform.applyY(cy);

		let tooClose = false;
		for (const existing of placed) {
			const dx = margin.left + transform.applyX(existing.cx) - screenX;
			const dy = margin.top + transform.applyY(existing.cy) - screenY;
			if (Math.hypot(dx, dy) < minDistance) {
				tooClose = true;
				break;
			}
		}

		if (tooClose) continue;

		placed.push({ point, cx, cy });
	}

	return placed;
}
