import { useRef } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";
import { copyTextSilent } from "@/features/schedule/lib/clipboard";
import { nodeAsPng, saveBlob } from "@/features/schedule/lib/download";
import { buildIcs, planAsText } from "@/features/schedule/lib/export";
import { telemetry } from "@/features/schedule/lib/telemetry";
import type { Timetable } from "@/features/schedule/lib/plan-view";

export interface Exports {
	readonly exportIcs: () => void;
	readonly copyText: () => Promise<boolean> | undefined;
	readonly exportPng: () => Promise<boolean>;
	/** The grid element, for the PNG export to rasterise what is on screen. */
	readonly gridRef: RefObject<HTMLTableElement | null>;
	/** The phone day panel: the same export on a phone rasterises the shown day. */
	readonly phoneRef: RefObject<HTMLDivElement | null>;
}

/** The three one-shot copies of the timetable: file, text, picture. All of
 *  them render `planner.lessons`, the same rows and labels the grid and the
 *  subscription feed show. */
export const useExports = (planner: Timetable): Exports => {
	const { semester, lessons, week } = planner;
	const gridRef = useRef<HTMLTableElement>(null);
	const phoneRef = useRef<HTMLDivElement>(null);

	const exportIcs = () => {
		if (!semester) return;
		saveBlob(
			new Blob([buildIcs(semester, lessons)], {
				type: "text/calendar;charset=utf-8",
			}),
			"ukma-rozklad.ics",
		);
		toast.success("Файл збережено");
		telemetry.track("ics_exported", { target: "ics" });
	};

	const copyText = () => {
		if (!semester) return;
		telemetry.track("plan_copied", { target: "text" });
		return copyTextSilent(
			planAsText(semester.name, lessons, semester.weekDates),
		);
	};

	const exportPng = async (): Promise<boolean> => {
		const node = gridRef.current ?? phoneRef.current;
		if (!node) return false;
		const rect = node.getBoundingClientRect();
		try {
			const blob = await nodeAsPng(node);
			saveBlob(
				blob,
				week === undefined
					? "ukma-rozklad.png"
					: `ukma-rozklad-week-${week}.png`,
			);
			toast.success("Картинку збережено");
			telemetry.track("plan_copied", { target: "png" });
			return true;
		} catch (error) {
			telemetry.captureError(error, {
				where: "export_png",
				grid: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
			});
			toast.error("Не вдалося зберегти картинку");
			return false;
		}
	};

	return { exportIcs, copyText, exportPng, gridRef, phoneRef };
};
