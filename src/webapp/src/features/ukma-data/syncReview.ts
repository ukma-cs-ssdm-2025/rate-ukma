import type { SyncPreviewResponse } from "@/lib/api/generated";
import { numberAt } from "./sync";

export const RISKS = [
	"invisible",
	"visible",
	"moves_ratings",
	"unrated",
] as const;

export type Risk = (typeof RISKS)[number];

export const RISK_LABELS = {
	invisible: "Без видимих змін",
	visible: "Видимі зміни",
	moves_ratings: "Переносить оцінки",
	unrated: "Без оцінок",
} satisfies Record<Risk, string>;

export const RISK_BADGE = {
	invisible: "success",
	visible: "secondary",
	moves_ratings: "caution",
	unrated: "outline",
} satisfies Record<Risk, "success" | "secondary" | "caution" | "outline">;

export interface ApprovalCounts {
	applied: number;
	waiting: number;
	superseded: number;
	skipped: number;
	rejected: number;
}

export function approvalCounts(counts: unknown): ApprovalCounts {
	return {
		applied: numberAt(counts, "applied") ?? 0,
		waiting: numberAt(counts, "waiting") ?? 0,
		superseded: numberAt(counts, "superseded") ?? 0,
		skipped: numberAt(counts, "skipped") ?? 0,
		rejected: numberAt(counts, "rejected") ?? 0,
	};
}

export const STALE_HOURS = 48;

export const needsStaleTick = (preview: SyncPreviewResponse): boolean =>
	preview.run_age_hours !== null && preview.run_age_hours > STALE_HOURS;

export const needsMoveTick = (preview: SyncPreviewResponse): boolean =>
	preview.ratings_moved > 0 || preview.plans_moved > 0;

export const sameDay = (iso: string, now: Date = new Date()): boolean =>
	new Date(iso).toDateString() === now.toDateString();

const MOVES_RATINGS_KINDS: ReadonlySet<string> = new Set([
	"merge_courses",
	"move_offering",
	"relink_course",
	"place_offering",
]);

export function kindRisk(kind: string): Risk {
	if (MOVES_RATINGS_KINDS.has(kind)) {
		return "moves_ratings";
	}
	if (kind.startsWith("link_") || kind.startsWith("removed_")) {
		return "invisible";
	}
	return "visible";
}
