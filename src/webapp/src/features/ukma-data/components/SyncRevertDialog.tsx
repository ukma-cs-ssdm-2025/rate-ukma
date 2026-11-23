import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import type { SyncJournalEntry, SyncRevertResponse } from "@/lib/api/generated";
import { ukmaDataSyncRevert, useUkmaDataSyncRevert } from "@/lib/api/generated";
import {
	journalApplySummary,
	revertFailureText,
	revertIsRefused,
	revertRefusal,
	revertSummary,
} from "../syncActions";
import { invalidateSyncQueries, REVERT_CHECK_QUERY_KEY } from "../syncQueries";
import { Ago } from "./Term";

function BlockerList({ result }: Readonly<{ result: SyncRevertResponse }>) {
	return (
		<>
			<p className="text-sm">{result.detail}</p>
			{result.blockers.length > 0 ? (
				<ul aria-label="Перешкоди" className="space-y-1 text-sm">
					{result.blockers.map((blocker) => (
						<li
							key={`${blocker.change_id}-${blocker.reason}`}
							className="break-words"
						>
							<span className="text-muted-foreground">
								зміна #{blocker.change_id}
							</span>{" "}
							{blocker.text}
						</li>
					))}
				</ul>
			) : null}
		</>
	);
}

function CloseOnly() {
	return (
		<DialogFooter>
			<DialogClose asChild>
				<Button variant="outline">Закрити</Button>
			</DialogClose>
		</DialogFooter>
	);
}

export function SyncRevertButton({
	entry,
	onStart,
}: Readonly<{
	entry: SyncJournalEntry;
	onStart: (entry: SyncJournalEntry) => void;
}>) {
	return (
		<Button
			variant="outline"
			size="sm"
			onClick={() => onStart(entry)}
			className="shrink-0"
			aria-label={`Відкотити рішення #${entry.approval_id ?? "—"}`}
		>
			<RotateCcw aria-hidden="true" />
			Відкотити
		</Button>
	);
}

export function SyncRevertDialog({
	entry,
	onClose,
}: Readonly<{
	entry: SyncJournalEntry;
	onClose: () => void;
}>) {
	const queryClient = useQueryClient();
	const revert = useUkmaDataSyncRevert({
		mutation: {
			onSettled: () => invalidateSyncQueries(queryClient),
		},
	});
	const approvalId = entry.approval_id;
	const check = useQuery({
		queryKey: [REVERT_CHECK_QUERY_KEY, approvalId],
		queryFn: ({ signal }) =>
			ukmaDataSyncRevert(
				{ approval_id: approvalId ?? 0, dry_run: true },
				signal,
			),
		enabled: approvalId !== null,
		staleTime: 0,
		gcTime: 0,
		retry: false,
		refetchOnWindowFocus: false,
		refetchOnReconnect: false,
	});
	const writing = revert.isPending;
	const requestClose = () => {
		if (!writing) {
			onClose();
		}
	};
	const pending = revert.isIdle ? check.isLoading : revert.isPending;
	const error = revert.isIdle ? check.error : revert.error;
	const refused = revertRefusal(error);
	const result = revert.isIdle ? check.data : revert.data;
	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) {
					requestClose();
				}
			}}
		>
			<DialogContent
				onEscapeKeyDown={(event) => {
					if (writing) {
						event.preventDefault();
					}
				}}
			>
				<DialogHeader>
					<DialogTitle>Відкотити рішення #{approvalId ?? "—"}?</DialogTitle>
					<DialogDescription>
						{journalApplySummary(entry)} · {entry.who ?? "—"} ·{" "}
						<Ago iso={entry.when} />
					</DialogDescription>
				</DialogHeader>
				{pending ? (
					<p role="status" className="text-sm text-muted-foreground">
						{writing ? "Відкочую…" : "Перевіряю…"}
					</p>
				) : null}
				{!pending && refused ? (
					<>
						<BlockerList result={refused} />
						<CloseOnly />
					</>
				) : null}
				{!pending && !refused && error ? (
					<>
						<p role="alert" className="text-sm text-destructive">
							<span aria-hidden="true">✗</span>{" "}
							{revertFailureText(error, !revert.isIdle)}
						</p>
						<CloseOnly />
					</>
				) : null}
				{!pending && result ? (
					result.blockers.length > 0 ? (
						<>
							<BlockerList result={result} />
							<CloseOnly />
						</>
					) : revertIsRefused(result) ? (
						<>
							<p className="text-sm">{result.detail}</p>
							<CloseOnly />
						</>
					) : result.dry_run ? (
						<>
							<p className="text-sm">{revertSummary(result)}</p>
							<DialogFooter>
								<Button
									onClick={() =>
										revert.mutate({
											data: { approval_id: result.approval_id, dry_run: false },
										})
									}
								>
									Відкотити рішення #{result.approval_id}
								</Button>
								<DialogClose asChild>
									<Button variant="outline">Закрити</Button>
								</DialogClose>
							</DialogFooter>
						</>
					) : (
						<>
							<p role="status" className="text-sm">
								<span aria-hidden="true">✓</span> {result.detail}
							</p>
							<CloseOnly />
						</>
					)
				) : null}
			</DialogContent>
		</Dialog>
	);
}
