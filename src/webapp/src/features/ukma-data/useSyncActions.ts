import { useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/Toaster";
import type {
	AnswerEnum,
	SyncChange,
	SyncChangeGroupEnum as Group,
	SyncSourceEnum as Source,
} from "@/lib/api/generated";
import {
	getUkmaDataSyncPendingListQueryKey,
	getUkmaDataSyncRunsListQueryKey,
	useUkmaDataSyncApprove,
	useUkmaDataSyncChangeAnswer,
	useUkmaDataSyncMappingKeepApartUnrated,
	useUkmaDataSyncReject,
} from "@/lib/api/generated";
import type { ApprovalCounts, SyncRequest } from "./syncActions";
import {
	EMPTY_SELECTION,
	approveBody,
	collectPendingIds,
	countsText,
	readApprovalCounts,
	refusalOf,
	selectionRequests,
	sumApprovalCounts,
	totalRows,
} from "./syncActions";

export type SyncActionDialog =
	| {
			kind: "preview";
			requests: SyncRequest[];
			counts: string;
			confirmStale: boolean;
	  }
	| {
			kind: "stale";
			requests: SyncRequest[];
			preview: boolean;
			detail: string;
	  }
	| { kind: "reject"; requests: SyncRequest[]; rows: number }
	| { kind: "keepApart" };

export function useSyncActions(onChanged?: () => void) {
	const queryClient = useQueryClient();
	const approveMutation = useUkmaDataSyncApprove();
	const rejectMutation = useUkmaDataSyncReject();
	const answerMutation = useUkmaDataSyncChangeAnswer();
	const keepApartMutation = useUkmaDataSyncMappingKeepApartUnrated();
	const [dialog, setDialog] = useState<SyncActionDialog | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	const refresh = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: getUkmaDataSyncPendingListQueryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: getUkmaDataSyncRunsListQueryKey(),
			}),
			queryClient.invalidateQueries({
				predicate: (query) =>
					String(query.queryKey[0]).startsWith("/api/v1/ukma-data/sync/runs/"),
			}),
		]);
		onChanged?.();
	};

	const preview = async (requests: SyncRequest[], confirmStale: boolean) => {
		setBusy(true);
		setMessage(null);
		try {
			const counts: ApprovalCounts[] = [];
			for (const request of requests) {
				const approval = await approveMutation.mutateAsync({
					data: approveBody(request, true, confirmStale),
				});
				counts.push(readApprovalCounts(approval.counts));
			}
			setDialog({
				kind: "preview",
				requests,
				counts: countsText(sumApprovalCounts(counts)),
				confirmStale,
			});
		} catch (error) {
			const refusal = refusalOf(error);
			if (refusal.stale && !confirmStale) {
				setDialog({
					kind: "stale",
					requests,
					preview: true,
					detail: refusal.detail,
				});
			} else {
				setMessage(refusal.detail);
			}
		} finally {
			setBusy(false);
		}
	};

	const apply = async (requests: SyncRequest[], confirmStale: boolean) => {
		setBusy(true);
		setMessage(null);
		const counts: ApprovalCounts[] = [];
		try {
			for (const request of requests) {
				try {
					const approval = await approveMutation.mutateAsync({
						data: approveBody(request, false, confirmStale),
					});
					counts.push(readApprovalCounts(approval.counts));
				} catch (error) {
					if (!refusalOf(error).empty) {
						throw error;
					}
				}
			}
			setDialog(null);
			await refresh();
			toast.success(`Застосовано змін: ${sumApprovalCounts(counts).applied}`);
		} catch (error) {
			if (counts.length > 0) {
				await refresh();
			}
			const refusal = refusalOf(error);
			if (refusal.stale && !confirmStale) {
				setDialog({
					kind: "stale",
					requests,
					preview: false,
					detail: refusal.detail,
				});
			} else {
				setMessage(refusal.detail);
			}
		} finally {
			setBusy(false);
		}
	};

	const startApprove = async (
		requests: SyncRequest[],
		previewFirst: boolean,
		confirmStale = false,
	) => {
		if (requests.length === 0) {
			return;
		}
		if (previewFirst) {
			await preview(requests, confirmStale);
		} else {
			await apply(requests, confirmStale);
		}
	};

	const rejectNow = async (requests: SyncRequest[]) => {
		setBusy(true);
		setMessage(null);
		try {
			let rejected = 0;
			for (const request of requests) {
				const approval = await rejectMutation.mutateAsync({
					data: { change_ids: request.changeIds ?? [] },
				});
				rejected += readApprovalCounts(approval.counts).rejected;
			}
			setDialog(null);
			await refresh();
			toast.success(`Відхилено змін: ${rejected}`);
		} catch (error) {
			setMessage(refusalOf(error).detail);
		} finally {
			setBusy(false);
		}
	};

	const requestReject = async (requests: SyncRequest[]) => {
		if (requests.length === 0) {
			return;
		}
		const rows = totalRows(requests);
		if (rows > 1) {
			setDialog({ kind: "reject", requests, rows });
			return;
		}
		await rejectNow(requests);
	};

	const approveChange = async (change: SyncChange) => {
		await startApprove(
			[
				{
					source: change.source,
					group: change.group,
					kind: change.kind,
					changeIds: [change.id],
					rows: 1,
				},
			],
			false,
		);
	};

	const approveSelected = async (changes: SyncChange[]) => {
		const requests = selectionRequests(changes);
		await startApprove(requests, totalRows(requests) > 1);
	};

	const approveFilter = async (source: Source, group: Group, kind?: string) => {
		await startApprove([{ source, group, kind, rows: 2 }], true);
	};

	const rejectChange = async (change: SyncChange) => {
		await requestReject([
			{
				source: change.source,
				group: change.group,
				kind: change.kind,
				changeIds: [change.id],
				rows: 1,
			},
		]);
	};

	const rejectSelected = async (changes: SyncChange[]) => {
		await requestReject(selectionRequests(changes));
	};

	const rejectFilter = async (source: Source, group: Group, kind?: string) => {
		setBusy(true);
		setMessage(null);
		try {
			const ids = await collectPendingIds(source, group, kind);
			if (ids.length === 0) {
				setMessage(EMPTY_SELECTION);
				return;
			}
			await requestReject([
				{ source, group, kind, changeIds: ids, rows: ids.length },
			]);
		} catch (error) {
			setMessage(refusalOf(error).detail);
		} finally {
			setBusy(false);
		}
	};

	const answer = async (changeId: number, value: AnswerEnum, into?: string) => {
		setBusy(true);
		setMessage(null);
		try {
			await answerMutation.mutateAsync({
				changeId,
				data: into === undefined ? { answer: value } : { answer: value, into },
			});
			await refresh();
			toast.success("Відповідь збережено");
		} catch (error) {
			setMessage(refusalOf(error).detail);
		} finally {
			setBusy(false);
		}
	};

	const keepApartUnrated = async () => {
		setBusy(true);
		setMessage(null);
		try {
			const response = await keepApartMutation.mutateAsync();
			setDialog(null);
			await refresh();
			toast.success(`Залишено окремо запитань: ${response.count}`);
		} catch (error) {
			setMessage(refusalOf(error).detail);
		} finally {
			setBusy(false);
		}
	};

	const confirmDialog = async () => {
		if (dialog === null) {
			return;
		}
		if (dialog.kind === "preview") {
			await apply(dialog.requests, dialog.confirmStale);
		}
		if (dialog.kind === "stale") {
			await startApprove(dialog.requests, dialog.preview, true);
		}
		if (dialog.kind === "reject") {
			await rejectNow(dialog.requests);
		}
		if (dialog.kind === "keepApart") {
			await keepApartUnrated();
		}
	};

	return {
		dialog,
		message,
		busy,
		closeDialog: () => {
			if (!busy) {
				setDialog(null);
			}
		},
		clearMessage: () => setMessage(null),
		confirmDialog,
		approveChange,
		approveSelected,
		approveFilter,
		rejectChange,
		rejectSelected,
		rejectFilter,
		answer,
		openKeepApart: () => setDialog({ kind: "keepApart" }),
	};
}
