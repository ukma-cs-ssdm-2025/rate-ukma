import { useState } from "react";

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
import { useUkmaDataSyncRevert } from "@/lib/api/generated";
import {
	journalApplySummary,
	revertFailureText,
	revertSummary,
} from "../syncActions";
import { Ago } from "./Term";

function BlockerList({ result }: Readonly<{ result: SyncRevertResponse }>) {
	return (
		<>
			<p className="text-sm">{result.detail}</p>
			<ul aria-label="Перешкоди" className="space-y-1 text-sm">
				{result.blockers.map((blocker) => (
					<li key={blocker.change_id} className="break-words">
						<span className="text-muted-foreground">
							зміна #{blocker.change_id}
						</span>{" "}
						{blocker.text}
					</li>
				))}
			</ul>
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

export function SyncRevertAction({
	entry,
	onReverted,
}: Readonly<{
	entry: SyncJournalEntry;
	onReverted: () => void;
}>) {
	const [open, setOpen] = useState(false);
	const revert = useUkmaDataSyncRevert({
		mutation: {
			onSuccess: (_result, variables) => {
				if (variables.data.dry_run === false) {
					onReverted();
				}
			},
		},
	});
	const approvalId = entry.approval_id;
	const close = () => {
		setOpen(false);
		revert.reset();
	};
	const start = () => {
		if (approvalId === null) {
			return;
		}
		revert.reset();
		setOpen(true);
		revert.mutate({ data: { approval_id: approvalId, dry_run: true } });
	};
	const confirm = () => {
		if (approvalId === null) {
			return;
		}
		revert.mutate({ data: { approval_id: approvalId, dry_run: false } });
	};
	const writing = revert.isPending && revert.variables?.data.dry_run === false;
	const result = revert.data;
	return (
		<>
			<Button variant="outline" size="sm" onClick={start} className="shrink-0">
				<RotateCcw />
				Відкотити
			</Button>
			<Dialog
				open={open}
				onOpenChange={(next) => {
					if (!next) {
						close();
					}
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Відкотити рішення #{approvalId ?? "—"}?</DialogTitle>
						<DialogDescription>
							{journalApplySummary(entry)} · {entry.who ?? "—"} ·{" "}
							<Ago iso={entry.when} />
						</DialogDescription>
					</DialogHeader>
					{revert.isPending ? (
						<p role="status" className="text-sm text-muted-foreground">
							{writing ? "Відкочую…" : "Перевіряю…"}
						</p>
					) : null}
					{!revert.isPending && revert.error ? (
						<>
							<p role="alert" className="text-sm text-destructive">
								✗ {revertFailureText(revert.error)}
							</p>
							<CloseOnly />
						</>
					) : null}
					{!revert.isPending && result ? (
						result.blockers.length > 0 ? (
							<>
								<BlockerList result={result} />
								<CloseOnly />
							</>
						) : result.dry_run ? (
							<>
								<p className="text-sm">{revertSummary(result)}</p>
								<DialogFooter>
									<Button onClick={confirm}>
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
									✓ {result.detail}
								</p>
								<CloseOnly />
							</>
						)
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
