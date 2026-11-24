import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import type {
	SyncDecisionResponse,
	SyncPreviewRequest,
	SyncPreviewResponse,
} from "@/lib/api/generated";
import {
	useUkmaDataSyncApply,
	useUkmaDataSyncPreview,
	useUkmaDataSyncReject,
} from "@/lib/api/generated";
import { actionFailure } from "../syncActions";
import type { ActionFailure } from "../syncActions";
import { CHANGES_ACCUSATIVE, countWith, formatCount } from "../syncFormat";
import { invalidateSyncQueries } from "../syncQueries";
import { previewLines } from "../syncSteps";

type Stage =
	| { kind: "checking" }
	| { kind: "ready"; preview: SyncPreviewResponse }
	| { kind: "applying"; preview: SyncPreviewResponse }
	| { kind: "done"; response: SyncDecisionResponse }
	| { kind: "failed"; failure: ActionFailure };

function JournalLink() {
	return (
		<Button variant="outline" asChild>
			<Link to="/data/sync" search={{ tab: "history" }}>
				Журнал
			</Link>
		</Button>
	);
}

function StageBody({ stage }: Readonly<{ stage: Stage }>) {
	if (stage.kind === "checking") {
		return (
			<p role="status" className="flex items-center gap-2 text-sm">
				<Spinner /> Перевіряю, що застосується. Це може тривати до 30 с.
			</p>
		);
	}
	if (stage.kind === "failed") {
		return (
			<p role="alert" className="text-sm text-destructive">
				{stage.failure.text}
			</p>
		);
	}
	if (stage.kind === "done") {
		return (
			<p role="status" className="text-sm">
				{stage.response.detail}
			</p>
		);
	}
	const lines = previewLines(stage.preview);
	return (
		<div className="space-y-2 text-sm">
			<p>{lines.main}</p>
			{lines.notes.length > 0 ? (
				<ul className="space-y-1 text-muted-foreground">
					{lines.notes.map((note) => (
						<li key={note}>{note}</li>
					))}
				</ul>
			) : null}
			{stage.kind === "applying" ? (
				<p role="status" className="flex items-center gap-2">
					<Spinner /> Застосовую…
				</p>
			) : null}
		</div>
	);
}

function ApplyDialog({
	open,
	onOpenChange,
	selection,
	onDone,
}: Readonly<{
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selection: SyncPreviewRequest;
	onDone: () => void;
}>) {
	const [stage, setStage] = useState<Stage>({ kind: "checking" });
	const queryClient = useQueryClient();
	const preview = useUkmaDataSyncPreview();
	const apply = useUkmaDataSyncApply();
	const check = () => {
		setStage({ kind: "checking" });
		preview.mutate(
			{ data: selection },
			{
				onSuccess: (result) => setStage({ kind: "ready", preview: result }),
				onError: (error) =>
					setStage({ kind: "failed", failure: actionFailure(error) }),
			},
		);
	};
	const confirm = (checked: SyncPreviewResponse) => {
		setStage({ kind: "applying", preview: checked });
		apply.mutate(
			{
				data: {
					...selection,
					token: checked.token,
					client_key: crypto.randomUUID(),
				},
			},
			{
				onSuccess: (response) => {
					setStage({ kind: "done", response });
					onDone();
				},
				onError: (error) =>
					setStage({ kind: "failed", failure: actionFailure(error) }),
				onSettled: () => invalidateSyncQueries(queryClient),
			},
		);
	};
	const busy = stage.kind === "checking" || stage.kind === "applying";
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!busy) {
					onOpenChange(next);
				}
			}}
		>
			<DialogContent
				onOpenAutoFocus={() => {
					if (stage.kind === "checking" && !preview.isPending) {
						check();
					}
				}}
			>
				<DialogHeader>
					<DialogTitle>Застосувати зміни</DialogTitle>
					<DialogDescription>
						Спершу сайт пробує застосувати їх і нічого не записує.
					</DialogDescription>
				</DialogHeader>
				<StageBody stage={stage} />
				<DialogFooter>
					{stage.kind === "ready" && stage.preview.counts.applied > 0 ? (
						<Button onClick={() => confirm(stage.preview)}>
							Застосувати {formatCount(stage.preview.counts.applied)}
						</Button>
					) : null}
					{stage.kind === "failed" && stage.failure.retry ? (
						<Button onClick={check}>Перевірити ще раз</Button>
					) : null}
					{stage.kind === "done" ||
					(stage.kind === "failed" && stage.failure.journal) ? (
						<JournalLink />
					) : null}
					<Button
						variant={stage.kind === "done" ? "default" : "ghost"}
						disabled={busy}
						onClick={() => onOpenChange(false)}
					>
						{stage.kind === "done" ? "Готово" : "Скасувати"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function SyncApplyBar({
	selection,
	runId,
	selected,
	total,
	onDecided,
}: Readonly<{
	selection: SyncPreviewRequest;
	runId: number | null;
	selected: number;
	total: number;
	onDecided: () => void;
}>) {
	const [applyOpen, setApplyOpen] = useState(false);
	const [rejectOpen, setRejectOpen] = useState(false);
	const [rejectError, setRejectError] = useState<string | null>(null);
	const queryClient = useQueryClient();
	const reject = useUkmaDataSyncReject({
		mutation: {
			onSuccess: () => {
				setRejectError(null);
				onDecided();
			},
			onError: (error) => setRejectError(actionFailure(error).text),
			onSettled: () => invalidateSyncQueries(queryClient),
		},
	});
	const nothing = selected === 0;
	return (
		<div className="sticky bottom-0 z-10 -mx-4 border-t bg-background px-4 py-3 shadow-lg sm:mx-0 sm:rounded-xl sm:border sm:px-5">
			<div className="flex items-center gap-3">
				<p className="text-sm tabular-nums" aria-live="polite">
					<span className="hidden sm:inline">Вибрано </span>
					{formatCount(selected)} з {formatCount(total)}
				</p>
				<div className="ml-auto flex gap-2">
					<Button
						variant="ghost"
						disabled={nothing || reject.isPending || runId === null}
						onClick={() => setRejectOpen(true)}
					>
						Не зараз
					</Button>
					<Button
						disabled={nothing || runId === null}
						onClick={() => setApplyOpen(true)}
					>
						Застосувати
					</Button>
				</div>
			</div>
			{rejectError === null ? null : (
				<p role="alert" className="mt-2 text-sm text-destructive">
					{rejectError}
				</p>
			)}
			{applyOpen ? (
				<ApplyDialog
					open={applyOpen}
					onOpenChange={setApplyOpen}
					selection={selection}
					onDone={onDecided}
				/>
			) : null}
			<ConfirmDialog
				open={rejectOpen}
				onOpenChange={setRejectOpen}
				onConfirm={() => {
					setRejectOpen(false);
					if (runId !== null) {
						reject.mutate({
							data: {
								...selection,
								run: runId,
								client_key: crypto.randomUUID(),
							},
						});
					}
				}}
				title={`Відкласти ${countWith(selected, CHANGES_ACCUSATIVE)}?`}
				description="На сайті нічого не зміниться. Якщо САЗ не зміниться, вони повернуться після наступного читання."
				confirmText="Відкласти"
				cancelText="Скасувати"
			/>
		</div>
	);
}
