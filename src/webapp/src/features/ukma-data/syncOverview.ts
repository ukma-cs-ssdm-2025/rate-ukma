import type {
	SyncApprovalDetail,
	SyncChangeGroupEnum,
	SyncSummary,
} from "@/lib/api/generated";
import { isSyncKind, numberAt } from "./sync";
import { formatCount, pluralForm } from "./syncFormat";
import {
	KIND_TAB_LABELS,
	SKIP_REASON_LABELS,
	SKIP_REASONS,
} from "./syncLabels";
import type { TermName } from "./syncTerms";

export const NO_RETRY = { query: { retry: false } } as const;

export const GROUP_ORDER = [
	"new",
	"link",
	"change",
	"mapping",
	"removed",
] as const satisfies readonly SyncChangeGroupEnum[];

export interface GroupCount {
	group: (typeof GROUP_ORDER)[number];
	count: number;
	rated: number;
	kinds: Record<string, number>;
}

export function groupCounts(summary: SyncSummary): GroupCount[] {
	return GROUP_ORDER.map((group) => {
		const steps = summary.steps.filter((step) => step.group === group);
		const kinds: Record<string, number> = {};
		for (const step of steps) {
			for (const [kind, count] of Object.entries(step.kinds)) {
				kinds[kind] = (kinds[kind] ?? 0) + count;
			}
		}
		return {
			group,
			count: steps.reduce((sum, step) => sum + step.count, 0),
			rated: steps.reduce((sum, step) => sum + step.rated, 0),
			kinds,
		};
	});
}

export function kindParts(kinds: Readonly<Record<string, number>>): string {
	const parts = new Map<string, number>();
	for (const [kind, count] of Object.entries(kinds)) {
		const label = isSyncKind(kind) ? KIND_TAB_LABELS[kind].toLowerCase() : kind;
		parts.set(label, (parts.get(label) ?? 0) + count);
	}
	return [...parts.entries()]
		.filter(([, count]) => count > 0)
		.sort((left, right) => right[1] - left[1])
		.map(([label, count]) => `${label} ${formatCount(count)}`)
		.join(", ");
}

export const changesText = (count: number): string =>
	`${formatCount(count)} ${pluralForm(count, { one: "зміна", few: "зміни", many: "змін" })}`;

export interface SkippedReason {
	label: string;
	count: number;
}

const isSkipReason = (
	reason: string,
): reason is (typeof SKIP_REASONS)[number] =>
	SKIP_REASONS.some((known) => known === reason);

export function skippedReasons(summary: SyncSummary): SkippedReason[] {
	return Object.entries(summary.not_proposed)
		.filter(([, value]) => value.count > 0)
		.map(([reason, value]) => ({
			label: isSkipReason(reason) ? SKIP_REASON_LABELS[reason] : reason,
			count: value.count,
		}))
		.sort((left, right) => right.count - left.count);
}

export function approvalTerm(approval: SyncApprovalDetail): TermName | null {
	if (approval.outcome !== "applied") {
		return null;
	}
	return approval.action === "reject" ? "rejected" : "applied";
}

export function approverName(email: string | null): string {
	if (email === null) {
		return "авто";
	}
	return email.split("@")[0] ?? email;
}

export interface ApprovalCounts {
	applied: number;
	waiting: number;
	superseded: number;
	rejected: number;
}

export function approvalCounts(counts: unknown): ApprovalCounts {
	return {
		applied: numberAt(counts, "applied") ?? 0,
		waiting: numberAt(counts, "waiting") ?? 0,
		superseded: numberAt(counts, "superseded") ?? 0,
		rejected: numberAt(counts, "rejected") ?? 0,
	};
}
