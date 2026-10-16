import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toaster";
import type { Decision, DecisionKind, ReviewCase } from "../api/schemas";
import { useDecide } from "../hooks/useUkmaData";
import {
	availableDecisions,
	DECISION_EFFECTS,
	DECISION_LABELS,
} from "../reviewCases";

const SECONDARY: ReadonlySet<DecisionKind> = new Set([
	"keep_apart",
	"keep_unlinked",
	"drop_removals",
]);

export function DecisionActions({
	reviewCase,
	decision,
	selectedInstructorId,
}: Readonly<{
	reviewCase: ReviewCase;
	decision: Decision | undefined;
	selectedInstructorId: string | null;
}>) {
	const [pending, setPending] = useState<DecisionKind | null>(null);
	const decide = useDecide();
	const kinds = availableDecisions(reviewCase, decision);
	if (kinds.length === 0) return null;

	const confirm = () => {
		if (!pending) return;
		decide.mutate(
			{
				kind: pending,
				reviewCaseId: reviewCase.id,
				reversesId: pending === "split" ? decision?.id : undefined,
				instructorId:
					pending === "link_instructor"
						? (selectedInstructorId ?? undefined)
						: undefined,
			},
			{
				onSuccess: () => toast.success("Рішення збережено"),
				onError: () => toast.error("Не вдалося зберегти рішення"),
			},
		);
		setPending(null);
	};

	return (
		<div className="flex flex-col gap-2 sm:flex-row">
			{kinds.map((kind) => (
				<Button
					key={kind}
					variant={SECONDARY.has(kind) ? "outline" : "default"}
					disabled={
						decide.isPending ||
						(kind === "link_instructor" && !selectedInstructorId)
					}
					onClick={() => setPending(kind)}
				>
					{DECISION_LABELS[kind]}
				</Button>
			))}
			<ConfirmDialog
				open={pending !== null}
				onOpenChange={(open) => !open && setPending(null)}
				onConfirm={confirm}
				title={pending ? `${DECISION_LABELS[pending]}?` : ""}
				description={pending ? DECISION_EFFECTS[pending] : ""}
				confirmText={pending ? DECISION_LABELS[pending] : undefined}
				variant={pending === "apply_removals" ? "destructive" : "default"}
			/>
		</div>
	);
}
