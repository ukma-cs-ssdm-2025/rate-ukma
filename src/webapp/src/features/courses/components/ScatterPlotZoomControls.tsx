import type { RefObject } from "react";

import { Minus, Plus } from "lucide-react";
import { select } from "d3-selection";
import type { zoom as d3Zoom } from "d3-zoom";

import { Button } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";

const ZOOM_IN_FACTOR = 1.25;
const ZOOM_OUT_FACTOR = 0.8;

export function ScatterPlotZoomControls({
	svgRef,
	zoomRef,
}: Readonly<{
	svgRef: RefObject<SVGSVGElement | null>;
	zoomRef: RefObject<ReturnType<typeof d3Zoom<SVGSVGElement, unknown>> | null>;
}>) {
	return (
		<div className="absolute bottom-16 right-3 overflow-hidden rounded-full border bg-card/90 shadow-sm backdrop-blur">
			<ButtonGroup
				orientation="vertical"
				aria-label="Керування масштабом графіка"
				className="border-0 bg-transparent shadow-none"
			>
				<Button
					variant="ghost"
					size="icon-lg"
					className="shadow-none"
					onClick={() => {
						if (!zoomRef.current || !svgRef.current) {
							return;
						}
						zoomRef.current.scaleBy(select(svgRef.current), ZOOM_IN_FACTOR);
					}}
					aria-label="Збільшити"
				>
					<Plus className="size-4" />
				</Button>
				<Button
					variant="ghost"
					size="icon-lg"
					className="shadow-none"
					onClick={() => {
						if (!zoomRef.current || !svgRef.current) {
							return;
						}
						zoomRef.current.scaleBy(select(svgRef.current), ZOOM_OUT_FACTOR);
					}}
					aria-label="Зменшити"
				>
					<Minus className="size-4" />
				</Button>
			</ButtonGroup>
		</div>
	);
}
