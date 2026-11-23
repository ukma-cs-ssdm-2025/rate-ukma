import { useEffect, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type {
	SyncChangeKindEnum,
	SyncDecisionResponse,
	SyncPreviewResponse,
	SyncSelectionGroupEnum,
} from "@/lib/api/generated";
import {
	useUkmaDataSyncApply,
	useUkmaDataSyncReject,
} from "@/lib/api/generated";
import type { ActionFailure } from "../syncActions";
import {
	actionFailure,
	applyLabel,
	applyProgress,
	rejectConfirm,
	rejectLabel,
	rejectProgress,
} from "../syncActions";
import { invalidateSyncQueries } from "../syncQueries";

type Outcome =
	| { kind: "applied"; response: SyncDecisionResponse }
	| { kind: "rejected"; response: SyncDecisionResponse }
	| { kind: "failure"; failure: ActionFailure };

export function PreviewClose({
	disabled = false,
}: Readonly<{ disabled?: boolean }>) {
	if (disabled) {
		return (
			<Button variant="ghost" disabled>
				Закрити
			</Button>
		);
	}
	return (
		<Button variant="ghost" asChild>
			<Link to="/data/sync" search={{ tab: "pending" }}>
				Закрити
			</Link>
		</Button>
	);
}

function OutcomeView({
	outcome,
	onRetry,
}: Readonly<{ outcome: Outcome; onRetry: () => void }>) {
	const result = useRef<HTMLParagraphElement>(null);
	useEffect(() => {
		result.current?.focus();
	}, []);
	if (outcome.kind === "failure") {
		const { failure } = outcome;
		return (
			<div className="space-y-3 rounded-xl border bg-card p-4">
				<p
					ref={result}
					role="alert"
					tabIndex={-1}
					className="text-sm text-destructive"
				>
					<span aria-hidden="true">✗</span> {failure.text}
				</p>
				<div className="flex flex-wrap items-center gap-2">
					{failure.retry ? (
						<Button onClick={onRetry}>
							{failure.code === "selection_changed"
								? "Переглянути ще раз"
								: "Спробувати ще"}
						</Button>
					) : null}
					{failure.journal ? (
						<Button variant="outline" asChild>
							<Link to="/data/sync" search={{ tab: "history" }}>
								Журнал
							</Link>
						</Button>
					) : null}
					<PreviewClose />
				</div>
			</div>
		);
	}
	const { response } = outcome;
	return (
		<div className="space-y-3 rounded-xl border bg-card p-4">
			<p ref={result} role="status" tabIndex={-1} className="text-sm">
				<span aria-hidden="true">✓</span> {response.detail}
			</p>
			<div className="flex flex-wrap items-center gap-2">
				{outcome.kind === "applied" && response.counts.remaining > 0 ? (
					<Button onClick={onRetry}>Переглянути решту</Button>
				) : null}
				{outcome.kind === "applied" ? (
					<Button variant="outline" asChild>
						<Link to="/data/sync" search={{ tab: "history" }}>
							Відкрити в Журналі
						</Link>
					</Button>
				) : null}
				<PreviewClose />
			</div>
		</div>
	);
}

export function SyncPreviewActions({
	group,
	kind,
	preview,
	onRefresh,
	onDecided,
}: Readonly<{
	group: SyncSelectionGroupEnum;
	kind: SyncChangeKindEnum | null;
	preview: SyncPreviewResponse;
	onRefresh: () => void;
	onDecided: () => void;
}>) {
	const [outcome, setOutcome] = useState<Outcome | null>(null);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const queryClient = useQueryClient();
	const settle = () => invalidateSyncQueries(queryClient);
	const apply = useUkmaDataSyncApply({
		mutation: {
			onSuccess: (response) => {
				setOutcome({ kind: "applied", response });
				onDecided();
			},
			onError: (error) => {
				setOutcome({ kind: "failure", failure: actionFailure(error) });
			},
			onSettled: settle,
		},
	});
	const reject = useUkmaDataSyncReject({
		mutation: {
			onSuccess: (response) => {
				setOutcome({ kind: "rejected", response });
				onDecided();
			},
			onError: (error) => {
				setOutcome({ kind: "failure", failure: actionFailure(error) });
			},
			onSettled: settle,
		},
	});
	const pending = apply.isPending
		? "apply"
		: reject.isPending
			? "reject"
			: null;
	const retry = () => {
		setOutcome(null);
		onRefresh();
	};
	const startApply = () => {
		setOutcome(null);
		apply.mutate({
			data: {
				source: "catalog",
				group,
				kind,
				token: preview.token,
				client_key: crypto.randomUUID(),
			},
		});
	};
	const startReject = () => {
		if (reject.isPending) {
			return;
		}
		setOutcome(null);
		setConfirmOpen(false);
		reject.mutate({
			data: {
				run: preview.run.id,
				source: "catalog",
				group,
				kind,
				client_key: crypto.randomUUID(),
			},
		});
	};
	if (outcome !== null) {
		return <OutcomeView outcome={outcome} onRetry={retry} />;
	}
	const confirm = rejectConfirm(preview.counts);
	return (
		<div className="space-y-3 rounded-xl border bg-card p-4">
			<div className="flex flex-wrap items-center gap-2">
				{preview.counts.applied > 0 ? (
					<Button onClick={startApply} disabled={pending !== null}>
						{applyLabel(preview.counts)}
					</Button>
				) : null}
				<Button
					variant="outline"
					onClick={() => setConfirmOpen(true)}
					disabled={pending !== null}
				>
					{rejectLabel(preview.counts)}
				</Button>
				<PreviewClose disabled={pending !== null} />
			</div>
			{pending === "apply" ? (
				<p role="status" className="text-sm text-muted-foreground">
					{applyProgress(preview.counts)}
				</p>
			) : null}
			{pending === "reject" ? (
				<p role="status" className="text-sm text-muted-foreground">
					{rejectProgress(preview.counts)}
				</p>
			) : null}
			<ConfirmDialog
				open={confirmOpen}
				onOpenChange={setConfirmOpen}
				onConfirm={startReject}
				title={confirm.title}
				description={confirm.description}
				confirmText="Відхилити"
				cancelText="Закрити"
				variant="destructive"
			/>
		</div>
	);
}
