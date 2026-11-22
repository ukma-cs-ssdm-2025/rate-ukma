import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Check } from "lucide-react";

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
import type { SyncApproval, SyncPreviewResponse } from "@/lib/api/generated";
import {
	ukmaDataSyncApprove,
	ukmaDataSyncPreview,
	ukmaDataSyncReject,
} from "@/lib/api/generated";
import { useSyncApplyLock } from "../hooks/useSyncApplyLock";
import { bannerFor, previewNote, requestTotal } from "../syncConfirm";
import type { ConfirmRequest, DoneBanner } from "../syncConfirm";
import { formatCount } from "../syncFormat";
import { HOLDER_LABELS } from "../syncLabels";
import { parseConflict } from "../syncReasons";
import type { Conflict } from "../syncReasons";
import { needsMoveTick, needsStaleTick } from "../syncReview";

interface Previews {
	approve: SyncPreviewResponse | null;
	reject: SyncPreviewResponse | null;
}

const isSyncQuery = (key: readonly unknown[]): boolean =>
	typeof key[0] === "string" && key[0].startsWith("/api/v1/ukma-data/sync/");

function conflictOf(error: unknown): Conflict {
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

function PartsTable({ request }: Readonly<{ request: ConfirmRequest }>) {
	return (
		<div className="overflow-hidden rounded-lg border text-sm">
			{request.parts.map((part) => (
				<div
					key={part.label}
					className="flex justify-between gap-4 border-b px-4 py-2.5"
				>
					<span>{part.label}</span>
					<span className="tabular-nums">{formatCount(part.count)}</span>
				</div>
			))}
			<div className="flex justify-between gap-4 bg-muted px-4 py-2.5 font-semibold">
				<span>Разом</span>
				<span className="tabular-nums">
					{formatCount(requestTotal(request))}
				</span>
			</div>
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

export function SyncConfirmDialog({
	request,
	run,
	onClose,
	onDone,
}: Readonly<{
	request: ConfirmRequest;
	run: number;
	onClose: () => void;
	onDone: (banner: DoneBanner) => void;
}>) {
	const queryClient = useQueryClient();
	const { locked } = useSyncApplyLock();
	const [clientKey] = useState(() => globalThis.crypto.randomUUID());
	const [attempt, setAttempt] = useState(0);
	const [movesSeen, setMovesSeen] = useState(false);
	const [staleSeen, setStaleSeen] = useState(false);
	const preview = useQuery({
		queryKey: ["sync-confirm-preview", run, attempt, request],
		retry: false,
		gcTime: 0,
		staleTime: Number.POSITIVE_INFINITY,
		queryFn: async (): Promise<Previews> => ({
			approve: request.approve
				? await ukmaDataSyncPreview({
						source: "catalog",
						run,
						selection: request.approve.selection,
					})
				: null,
			reject: request.reject
				? await ukmaDataSyncPreview({
						source: "catalog",
						run,
						selection: request.reject,
					})
				: null,
		}),
	});
	const confirm = useMutation({
		mutationFn: async (previews: Previews): Promise<SyncApproval[]> => {
			const results: SyncApproval[] = [];
			if (request.approve && previews.approve) {
				results.push(
					await ukmaDataSyncApprove({
						source: "catalog",
						run,
						group: request.approve.group,
						kind: request.approve.kind,
						selection: request.approve.selection,
						token: previews.approve.token,
						client_key: clientKey,
						confirm_stale: needsStaleTick(previews.approve),
					}),
				);
			}
			if (request.reject && previews.reject) {
				results.push(
					await ukmaDataSyncReject({
						source: "catalog",
						selection: request.reject,
						token: previews.reject.token,
					}),
				);
			}
			return results;
		},
		onSuccess: (results) => {
			void queryClient.invalidateQueries({
				predicate: (query) => isSyncQuery(query.queryKey),
			});
			onDone(bannerFor(request, results, run));
		},
		onError: () => {
			void queryClient.invalidateQueries({
				predicate: (query) => isSyncQuery(query.queryKey),
			});
		},
	});
	const data = preview.data;
	const found =
		data === undefined
			? null
			: (data.approve?.count ?? 0) + (data.reject?.count ?? 0);
	const moves = data?.approve ? needsMoveTick(data.approve) : false;
	const stale = data?.approve ? needsStaleTick(data.approve) : false;
	const ready =
		data !== undefined && (!moves || movesSeen) && (!stale || staleSeen);
	const reviewAgain = () => {
		confirm.reset();
		setMovesSeen(false);
		setStaleSeen(false);
		setAttempt((value) => value + 1);
	};
	return (
		<Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
			<DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>{request.title}</DialogTitle>
					<DialogDescription>
						{previewNote(requestTotal(request), found)}
					</DialogDescription>
				</DialogHeader>
				<PartsTable request={request} />
				<ul className="space-y-2 text-sm">
					{request.ticks.map((tick) => (
						<li key={tick} className="flex items-start gap-2">
							<Check className="mt-0.5 size-4 shrink-0 text-success" />
							<span>{tick}</span>
						</li>
					))}
				</ul>
				{preview.isLoading ? (
					<Skeleton className="h-6" aria-label="Перевіряємо список" />
				) : null}
				{preview.isError ? (
					<ConflictMessage
						conflict={conflictOf(preview.error)}
						onReview={reviewAgain}
					/>
				) : null}
				{moves && data?.approve ? (
					<Tick
						id="sync-moves-seen"
						checked={movesSeen}
						onChange={setMovesSeen}
					>
						На іншу сторінку перейдуть {formatCount(data.approve.ratings_moved)}{" "}
						оцінок і {formatCount(data.approve.plans_moved)} планів. Я це
						переглянув(-ла)
					</Tick>
				) : null}
				{stale && data?.approve ? (
					<Tick
						id="sync-stale-seen"
						checked={staleSeen}
						onChange={setStaleSeen}
					>
						Дані САЗ перевірено {data.approve.run_age_hours} год тому. Я
						розумію, що вони могли змінитися
					</Tick>
				) : null}
				{confirm.isError ? (
					<ConflictMessage
						conflict={conflictOf(confirm.error)}
						onReview={reviewAgain}
					/>
				) : null}
				<DialogFooter className="flex-col gap-2 sm:flex-row">
					<Button variant="outline" onClick={onClose}>
						Скасувати
					</Button>
					<Button
						disabled={!ready || locked || confirm.isPending || confirm.isError}
						onClick={() => {
							if (data !== undefined) {
								confirm.mutate(data);
							}
						}}
					>
						{request.confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
