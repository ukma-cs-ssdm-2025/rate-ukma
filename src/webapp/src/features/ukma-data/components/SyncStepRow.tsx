import { Check } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { SyncApprovalDetail, SyncSummaryStep } from "@/lib/api/generated";
import { useCurrentEmail } from "../hooks/useSyncApplyLock";
import {
	countWith,
	formatCount,
	formatTime,
	PLANS,
	RATINGS,
} from "../syncFormat";
import {
	approvalCounts,
	parseFacets,
	RISK_BADGE,
	RISK_LABELS,
	STEP_ACTIONS,
	STEP_EFFECTS,
	STEP_RISK,
	STEP_TITLES,
} from "../syncReview";
import type { ReviewStep } from "../syncReview";
import { approverName } from "./SyncActiveBanner";

interface StepRowProps {
	number: number;
	step: ReviewStep;
	summary: SyncSummaryStep;
	applied: SyncApprovalDetail | null;
	primary: boolean;
	onOpen: () => void;
}

export function RatedChip({
	ratings,
	plans,
}: Readonly<{ ratings: number; plans: number }>) {
	const parts = [
		ratings > 0 ? countWith(ratings, RATINGS) : null,
		plans > 0 ? countWith(plans, PLANS) : null,
	].filter((part): part is string => part !== null);
	if (parts.length === 0) {
		return null;
	}
	return (
		<Badge variant="caution" className="tabular-nums">
			{parts.join(" · ")}
		</Badge>
	);
}

function StepNotes({
	step,
	summary,
}: Readonly<{ step: ReviewStep; summary: SyncSummaryStep }>) {
	const facets = parseFacets(summary.facets);
	const notes: string[] = [];
	if (step === "new_rows" && facets.similarExisting) {
		notes.push(
			`${formatCount(facets.similarExisting)} схожі на курси, які вже є.`,
		);
	}
	if (summary.waiting > 0) {
		notes.push(`${formatCount(summary.waiting)} чекають на інші зміни.`);
	}
	if (notes.length === 0) {
		return null;
	}
	return (
		<p className="text-sm text-muted-foreground tabular-nums">
			{notes.join(" ")}
		</p>
	);
}

function DoneRow({
	number,
	step,
	applied,
}: Readonly<{
	number: number;
	step: ReviewStep;
	applied: SyncApprovalDetail | null;
}>) {
	const currentEmail = useCurrentEmail();
	return (
		<li className="flex items-start gap-3 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
			<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
				<Check className="size-3.5" aria-hidden="true" />
			</span>
			<p className="min-w-0">
				<span className="sr-only">Крок {number}. </span>
				<span className="font-medium text-foreground">{STEP_TITLES[step]}</span>
				{" — "}
				{applied === null ? (
					"нічого не чекає"
				) : (
					<span className="tabular-nums">
						✓ Застосовано {formatCount(approvalCounts(applied.counts).applied)}{" "}
						— {approverName(applied.user_email, currentEmail)},{" "}
						{formatTime(applied.created_at)}
					</span>
				)}
			</p>
		</li>
	);
}

export function SyncStepRow({
	number,
	step,
	summary,
	applied,
	primary,
	onOpen,
}: Readonly<StepRowProps>) {
	if (summary.count === 0) {
		return <DoneRow number={number} step={step} applied={applied} />;
	}
	const risk = STEP_RISK[step];
	const headingId = `sync-step-${step}`;
	return (
		<li
			aria-labelledby={headingId}
			className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-start"
		>
			<span
				aria-hidden="true"
				className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums"
			>
				{number}
			</span>
			<div className="min-w-0 flex-1 space-y-1.5">
				<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
					<h3 id={headingId} className="font-medium">
						<span className="sr-only">Крок {number}. </span>
						{STEP_TITLES[step]}
					</h3>
					<span className="text-lg font-semibold tabular-nums">
						{formatCount(summary.count)}
					</span>
					<Badge variant={RISK_BADGE[risk]}>{RISK_LABELS[risk]}</Badge>
					<RatedChip ratings={summary.ratings} plans={summary.plans} />
				</div>
				<p className="text-sm text-muted-foreground">{STEP_EFFECTS[step]}</p>
				<StepNotes step={step} summary={summary} />
			</div>
			<Button
				variant={primary ? "default" : "outline"}
				className="w-full sm:w-auto"
				onClick={onOpen}
				aria-describedby={headingId}
			>
				{STEP_ACTIONS[step]}
			</Button>
		</li>
	);
}
