import { useId } from "react";

import { cn } from "@/lib/utils";

export interface YearScore {
	/** Academic year start: 2024 is 2024–2025. */
	year: number;
	value: number;
	count: number;
}

const W = 112;
const H = 44;
const PAD = 5;

export function formatAcademicYear(year: number) {
	return `${year}–${year + 1}`;
}

/**
 * A sparkline of yearly averages. It is a scrubber, not a chart: pointing at a
 * year hands that year to the card, which shows its score in place of the
 * all-time one, so the card needs no axis or labels of its own.
 */
export function ScoreTrend({
	points,
	active,
	onActiveChange,
	className,
	label,
}: Readonly<{
	points: YearScore[];
	active: number | null;
	onActiveChange: (index: number | null) => void;
	className?: string;
	label: string;
}>) {
	const gradientId = useId();
	const values = points.map((p) => p.value);
	// Shape matters more than position here; the exact value is on the card.
	const lo = Math.max(1, Math.min(...values) - 0.4);
	const hi = Math.min(5, Math.max(...values) + 0.4);
	const x = (i: number) => PAD + (i * (W - PAD * 2)) / (points.length - 1);
	const y = (v: number) => PAD + ((hi - v) / (hi - lo || 1)) * (H - PAD * 2);
	const line = points
		.map(
			(p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`,
		)
		.join("");
	const area = `${line}L${x(points.length - 1)},${H}L${x(0)},${H}Z`;
	const shown = active ?? points.length - 1;

	const pick = (clientX: number, rect: DOMRect) => {
		const ratio = (clientX - rect.left) / rect.width;
		const index = Math.round(ratio * (points.length - 1));
		onActiveChange(Math.min(points.length - 1, Math.max(0, index)));
	};

	return (
		<svg
			viewBox={`0 0 ${W} ${H}`}
			className={cn(
				"h-11 w-28 shrink-0 touch-none overflow-visible outline-none",
				className,
			)}
			role="slider"
			tabIndex={0}
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={points.length - 1}
			aria-valuenow={shown}
			aria-valuetext={`${formatAcademicYear(points[shown].year)}: ${points[shown].value.toFixed(1)}`}
			onPointerMove={(e) =>
				pick(e.clientX, e.currentTarget.getBoundingClientRect())
			}
			onPointerDown={(e) =>
				pick(e.clientX, e.currentTarget.getBoundingClientRect())
			}
			onPointerLeave={(e) => {
				if (e.pointerType === "mouse") onActiveChange(null);
			}}
			onBlur={() => onActiveChange(null)}
			onKeyDown={(e) => {
				if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
				e.preventDefault();
				const step = e.key === "ArrowLeft" ? -1 : 1;
				onActiveChange(Math.min(points.length - 1, Math.max(0, shown + step)));
			}}
		>
			<defs>
				<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
					<stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
					<stop offset="1" stopColor="currentColor" stopOpacity="0" />
				</linearGradient>
			</defs>
			<path d={area} fill={`url(#${gradientId})`} />
			<path
				d={line}
				fill="none"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
			/>
			{active != null && (
				<line
					x1={x(active)}
					x2={x(active)}
					y1={0}
					y2={H}
					stroke="currentColor"
					strokeOpacity={0.25}
					vectorEffect="non-scaling-stroke"
				/>
			)}
			<circle
				cx={x(shown)}
				cy={y(points[shown].value)}
				r={3.5}
				fill="currentColor"
				stroke="var(--color-card)"
				strokeWidth={2}
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
