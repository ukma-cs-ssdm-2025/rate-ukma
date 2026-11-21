import { Group } from "@visx/group";
import type { scaleLinear } from "@visx/scale";

import type { Margin } from "./scatterLabeling";

const AXIS_TICK_FONT_SIZE = 12;
const AXIS_LABEL_FONT_SIZE = 12;
const AXIS_LABEL_FONT_WEIGHT = 500;
const AXIS_BG_TOP_EXTENSION = 20;
const X_AXIS_TICK_Y_OFFSET = 20;
const X_AXIS_LABEL_Y_OFFSET = 45;
const Y_AXIS_TICK_X_OFFSET = 10;
const Y_AXIS_LABEL_X_OFFSET = 35;
const NUM_AXIS_TICKS = 5;

type AxisScale = ReturnType<typeof scaleLinear<number>>;

export function ScatterPlotAxes({
	plotMargin,
	innerWidth,
	innerHeight,
	xAxisScale,
	yAxisScale,
}: Readonly<{
	plotMargin: Margin;
	innerWidth: number;
	innerHeight: number;
	xAxisScale: AxisScale;
	yAxisScale: AxisScale;
}>) {
	return (
		<Group left={plotMargin.left} top={plotMargin.top}>
			<rect
				x={-plotMargin.left}
				y={innerHeight}
				width={innerWidth + plotMargin.left}
				height={plotMargin.bottom}
				fill="var(--plot-surface, var(--color-background))"
			/>

			<rect
				x={-plotMargin.left}
				y={-AXIS_BG_TOP_EXTENSION}
				width={plotMargin.left}
				height={innerHeight + AXIS_BG_TOP_EXTENSION}
				fill="var(--plot-surface, var(--color-background))"
			/>

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

			<text
				x={innerWidth / 2}
				y={innerHeight + X_AXIS_LABEL_Y_OFFSET}
				fill="var(--color-muted-foreground)"
				fontSize={AXIS_LABEL_FONT_SIZE}
				fontWeight={AXIS_LABEL_FONT_WEIGHT}
				textAnchor="middle"
				dominantBaseline="middle"
			>
				Корисність
			</text>

			<text
				x={-Y_AXIS_LABEL_X_OFFSET}
				y={innerHeight / 2}
				fill="var(--color-muted-foreground)"
				fontSize={AXIS_LABEL_FONT_SIZE}
				fontWeight={AXIS_LABEL_FONT_WEIGHT}
				textAnchor="middle"
				dominantBaseline="middle"
				transform={`rotate(-90, -${Y_AXIS_LABEL_X_OFFSET}, ${innerHeight / 2})`}
			>
				Складність
			</text>
		</Group>
	);
}
