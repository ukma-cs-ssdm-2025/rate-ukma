import { useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

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
import { CHANGES_ACCUSATIVE, countWith, formatCount } from "../syncFormat";
import { invalidateSyncQueries } from "../syncQueries";
import { JournalLink, StageBody } from "./SyncApplyStages";
import type { Progress, Stage } from "./SyncApplyStages";

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
	const [stage, setStage] = useState<Stage>({
		kind: "checking",
		progress: null,
	});
	const stopAfterPart = useRef(false);
	const [stopping, setStopping] = useState(false);
	const queryClient = useQueryClient();
	const preview = useUkmaDataSyncPreview();
	const apply = useUkmaDataSyncApply();
	const finish = (
		response: SyncDecisionResponse,
		progress: Progress,
		stopped: boolean,
	) => {
		setStage({ kind: "done", response, progress, stopped });
		onDone();
	};
	const applyPart = (checked: SyncPreviewResponse, progress: Progress) => {
		setStage({ kind: "applying", progress });
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
					const next = {
						...progress,
						applied: progress.applied + response.counts.applied,
						parts: progress.parts + 1,
					};
					const more =
						response.counts.remaining > 0 &&
						response.counts.applied > 0 &&
						next.applied < next.planned;
					if (!more || stopAfterPart.current) {
						finish(response, next, more);
						return;
					}
					setStage({ kind: "checking", progress: next });
					preview.mutate(
						{ data: selection },
						{
							onSuccess: (result) => {
								if (result.counts.applied === 0) {
									finish(response, next, false);
								} else if (stopAfterPart.current) {
									finish(response, next, true);
								} else {
									applyPart(result, next);
								}
							},
							onError: (error) =>
								setStage({
									kind: "failed",
									failure: actionFailure(error),
									progress: next,
								}),
						},
					);
				},
				onError: (error) =>
					setStage({
						kind: "failed",
						failure: actionFailure(error),
						progress,
					}),
				onSettled: () => invalidateSyncQueries(queryClient),
			},
		);
	};
	const check = () => {
		setStage({ kind: "checking", progress: null });
		preview.mutate(
			{ data: selection },
			{
				onSuccess: (result) => setStage({ kind: "ready", preview: result }),
				onError: (error) =>
					setStage({
						kind: "failed",
						failure: actionFailure(error),
						progress: null,
					}),
			},
		);
	};
	const busy = stage.kind === "checking" || stage.kind === "applying";
	const inParts = busy && stage.progress !== null;
	const planned =
		stage.kind === "ready"
			? stage.preview.counts.applied + stage.preview.counts.remaining
			: 0;
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
						<Button
							onClick={() => {
								stopAfterPart.current = false;
								setStopping(false);
								applyPart(stage.preview, { applied: 0, parts: 0, planned });
							}}
						>
							{stage.preview.counts.remaining > 0
								? `Застосувати всі ${formatCount(planned)}`
								: `Застосувати ${formatCount(stage.preview.counts.applied)}`}
						</Button>
					) : null}
					{stage.kind === "failed" && stage.failure.retry ? (
						<Button onClick={check}>Перевірити ще раз</Button>
					) : null}
					{stage.kind === "done" ||
					(stage.kind === "failed" && stage.failure.journal) ? (
						<JournalLink />
					) : null}
					{inParts ? (
						<Button
							variant="outline"
							disabled={stopping}
							onClick={() => {
								stopAfterPart.current = true;
								setStopping(true);
							}}
						>
							{stopping ? "Зупиняю після цієї частини…" : "Зупинити"}
						</Button>
					) : (
						<Button
							variant={stage.kind === "done" ? "default" : "ghost"}
							disabled={busy}
							onClick={() => onOpenChange(false)}
						>
							{stage.kind === "done" ? "Готово" : "Скасувати"}
						</Button>
					)}
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
	disabled = false,
	onDecided,
}: Readonly<{
	selection: SyncPreviewRequest;
	runId: number | null;
	selected: number;
	total: number;
	disabled?: boolean;
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
	const nothing = selected === 0 || disabled || runId === null;
	return (
		<div className="sticky bottom-0 z-10 -mx-4 border-t bg-background px-4 py-3 shadow-lg sm:mx-0 sm:rounded-xl sm:border sm:px-5">
			<div className="flex items-center gap-3">
				<p
					className="min-w-0 text-sm whitespace-nowrap tabular-nums"
					aria-live="polite"
				>
					{selected === total ? (
						<>
							<span className="hidden sm:inline">Вибрано </span>
							<span className="sm:hidden">Усі </span>
							<span className="hidden sm:inline">всі </span>
							{formatCount(total)}
						</>
					) : (
						<>
							<span className="hidden sm:inline">Вибрано </span>
							{formatCount(selected)} з {formatCount(total)}
						</>
					)}
				</p>
				<div className="ml-auto flex shrink-0 gap-2">
					<Button
						variant="ghost"
						disabled={nothing || reject.isPending}
						onClick={() => setRejectOpen(true)}
					>
						{reject.isPending ? <Spinner /> : null}
						Не зараз
					</Button>
					<Button disabled={nothing} onClick={() => setApplyOpen(true)}>
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
