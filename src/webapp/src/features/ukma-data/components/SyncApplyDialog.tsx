import { useEffect, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle2 } from "lucide-react";
import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { Label } from "@/components/ui/Label";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
	SyncApproval,
	SyncPreviewResponse,
	SyncSelection,
	SyncSourceEnum,
} from "@/lib/api/generated";
import {
	useUkmaDataSyncApprove,
	useUkmaDataSyncPreview,
} from "@/lib/api/generated";
import { useSyncApplyLock } from "../hooks/useSyncApplyLock";
import { formatCount, formatDayTime } from "../syncFormat";
import { HOLDER_LABELS } from "../syncLabels";
import { historyParams, tabParser } from "../syncParams";
import {
	approvalCounts,
	confirmLabel,
	needsMoveTick,
	needsStaleTick,
} from "../syncReview";
import type { ListStep } from "../syncReview";
import { parseConflict } from "../syncReasons";
import type { Conflict } from "../syncReasons";
import { SyncPreviewDetails } from "./SyncPreviewDetails";

export interface ApplyRequest {
	step: ListStep | null;
	title: string;
	selection: SyncSelection;
}

interface ApplyDialogProps {
	request: ApplyRequest;
	source: SyncSourceEnum;
	run: number;
	onClose: () => void;
	onNextStep: () => void;
	onApplied?: () => void;
}

const isSyncQuery = (key: readonly unknown[]): boolean =>
	typeof key[0] === "string" && key[0].startsWith("/api/v1/ukma-data/sync/");

function errorDetail(error: unknown): Conflict {
	const body: unknown = axios.isAxiosError(error)
		? error.response?.data
		: undefined;
	return (
		parseConflict(body) ?? {
			detail: "Не вдалося виконати дію. Спробуйте ще раз.",
			selectionChanged: false,
			holder: null,
			runAgeHours: null,
		}
	);
}

function ConflictMessage({
	conflict,
	onReview,
}: Readonly<{ conflict: Conflict; onReview: () => void }>) {
	return (
		<div
			role="alert"
			className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
		>
			<p>{conflict.detail}</p>
			{conflict.holder === null ? null : (
				<p>{HOLDER_LABELS[conflict.holder]}</p>
			)}
			{conflict.selectionChanged ? (
				<Button size="sm" variant="outline" onClick={onReview}>
					Переглянути ще раз
				</Button>
			) : null}
		</div>
	);
}

function Tick({
	id,
	checked,
	onChange,
	children,
}: Readonly<{
	id: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	children: React.ReactNode;
}>) {
	return (
		<div className="flex items-start gap-2 text-sm">
			<Checkbox
				id={id}
				checked={checked}
				onCheckedChange={(value) => onChange(value === true)}
				className="mt-0.5"
			/>
			<Label htmlFor={id} className="leading-snug font-normal">
				{children}
			</Label>
		</div>
	);
}

function ApplyResult({
	approval,
	run,
	onClose,
	onNextStep,
}: Readonly<{
	approval: SyncApproval;
	run: number;
	onClose: () => void;
	onNextStep: () => void;
}>) {
	const [, setParams] = useQueryStates({ tab: tabParser, ...historyParams });
	const counts = approvalCounts(approval.counts);
	return (
		<>
			<DialogHeader>
				<DialogTitle className="flex items-center gap-2">
					<CheckCircle2 className="size-5 text-success" />
					Готово
				</DialogTitle>
				<DialogDescription className="tabular-nums">
					Застосовано {formatCount(counts.applied)} · уже неактуальні{" "}
					{formatCount(counts.superseded)}
					{counts.waiting > 0
						? ` · чекають ${formatCount(counts.waiting)}`
						: ""}{" "}
					— ви, {formatDayTime(new Date().toISOString())} · Запуск {run}
				</DialogDescription>
			</DialogHeader>
			<DialogFooter className="flex-col gap-2 sm:flex-row">
				<Button
					variant="outline"
					onClick={() => {
						onClose();
						void setParams({ tab: "history", openRun: run });
					}}
				>
					Відкрити в історії
				</Button>
				<Button onClick={onNextStep}>Наступний крок</Button>
			</DialogFooter>
		</>
	);
}

export function SyncApplyDialog({
	request,
	source,
	run,
	onClose,
	onNextStep,
	onApplied,
}: Readonly<ApplyDialogProps>) {
	const queryClient = useQueryClient();
	const { locked } = useSyncApplyLock();
	const [clientKey] = useState(() => globalThis.crypto.randomUUID());
	const [movesSeen, setMovesSeen] = useState(false);
	const [staleSeen, setStaleSeen] = useState(false);
	const [conflict, setConflict] = useState<Conflict | null>(null);
	const [result, setResult] = useState<SyncApproval | null>(null);
	const preview = useUkmaDataSyncPreview();
	const approve = useUkmaDataSyncApprove({
		mutation: {
			onSuccess: (approval) => {
				setResult(approval);
				onApplied?.();
				void queryClient.invalidateQueries({
					predicate: (query) => isSyncQuery(query.queryKey),
				});
			},
			onError: (error) => setConflict(errorDetail(error)),
		},
	});
	const runPreview = preview.mutate;
	const selection = request.selection;
	useEffect(() => {
		runPreview({ data: { source, run, selection } });
	}, [runPreview, source, run, selection]);

	const reviewAgain = () => {
		setConflict(null);
		setMovesSeen(false);
		setStaleSeen(false);
		runPreview({ data: { source, run, selection } });
	};
	const data: SyncPreviewResponse | undefined = preview.data;
	const ready =
		data !== undefined &&
		(!needsMoveTick(data) || movesSeen) &&
		(!needsStaleTick(data) || staleSeen);
	return (
		<Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
				{result === null ? (
					<>
						<DialogHeader>
							<DialogTitle>{request.title}</DialogTitle>
							<DialogDescription>
								Перегляньте, що станеться. Застосується саме цей список.
							</DialogDescription>
						</DialogHeader>
						{preview.isPending ? (
							<Skeleton className="h-24" aria-label="Готуємо перегляд" />
						) : null}
						{preview.isError && conflict === null ? (
							<ConflictMessage
								conflict={errorDetail(preview.error)}
								onReview={reviewAgain}
							/>
						) : null}
						{data === undefined ? null : <SyncPreviewDetails preview={data} />}
						{data !== undefined && needsMoveTick(data) ? (
							<Tick
								id="sync-moves-seen"
								checked={movesSeen}
								onChange={setMovesSeen}
							>
								Я переглянув(-ла) список перенесень
							</Tick>
						) : null}
						{data !== undefined && needsStaleTick(data) ? (
							<Tick
								id="sync-stale-seen"
								checked={staleSeen}
								onChange={setStaleSeen}
							>
								Дані UKMA Data зібрано {data.run_age_hours} год тому. Я розумію,
								що вони могли змінитися
							</Tick>
						) : null}
						{conflict === null ? null : (
							<ConflictMessage conflict={conflict} onReview={reviewAgain} />
						)}
						<DialogFooter className="flex-col gap-2 sm:flex-row">
							<Button variant="outline" onClick={onClose}>
								Скасувати
							</Button>
							{data === undefined ? null : (
								<Button
									disabled={
										!ready || locked || approve.isPending || conflict !== null
									}
									onClick={() =>
										approve.mutate({
											data: {
												source,
												run,
												selection,
												token: data.token,
												client_key: clientKey,
												confirm_stale: needsStaleTick(data),
											},
										})
									}
								>
									{confirmLabel(request.step, data)}
								</Button>
							)}
						</DialogFooter>
					</>
				) : (
					<ApplyResult
						approval={result}
						run={run}
						onClose={onClose}
						onNextStep={onNextStep}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
}
