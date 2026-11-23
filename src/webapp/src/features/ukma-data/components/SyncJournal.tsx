import { useState } from "react";

import { useInfiniteQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
	SyncJournalEntry,
	UkmaDataSyncJournalParams,
} from "@/lib/api/generated";
import {
	ukmaDataSyncJournal,
	useUkmaDataStatusRetrieve,
} from "@/lib/api/generated";
import { undoneMergeIds } from "../caseActions";
import {
	journalEntryNumber,
	journalTitle,
	decisionErrorText,
} from "../syncActions";
import { PAGE_SIZE } from "../syncLabels";
import { NO_RETRY } from "../syncOverview";
import { JOURNAL_QUERY_KEY } from "../syncQueries";
import { UnmergeAction } from "./CaseActions";
import { SyncRevertButton, SyncRevertDialog } from "./SyncRevertDialog";
import { Ago } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

function JournalRow({
	entry,
	onRevert,
	decideEnabled,
	undone,
}: Readonly<{
	entry: SyncJournalEntry;
	onRevert: (entry: SyncJournalEntry) => void;
	decideEnabled: boolean;
	undone: boolean;
}>) {
	const reason =
		entry.kind === "apply" && !entry.revertible && !entry.reverted
			? entry.revert_reason
			: "";
	const decisionError =
		entry.kind === "decision" &&
		entry.outcome !== "done" &&
		entry.error.length > 0
			? decisionErrorText(entry)
			: "";
	return (
		<li className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-start sm:gap-3 sm:px-5">
			<span className="w-28 shrink-0 text-muted-foreground tabular-nums">
				{journalEntryNumber(entry)}
			</span>
			<div className="min-w-0 flex-1 space-y-1">
				<p className="break-words">
					{journalTitle(entry)}
					{entry.reverted ? (
						<span className="ml-2 text-muted-foreground">відкочено</span>
					) : null}
				</p>
				{reason.length > 0 ? (
					<p className="text-muted-foreground">{reason}</p>
				) : null}
				{decisionError.length > 0 ? (
					<p className="text-muted-foreground">{decisionError}</p>
				) : null}
			</div>
			<span className="shrink-0 text-muted-foreground">
				{entry.who ?? "—"}, <Ago iso={entry.when} />
			</span>
			{entry.revertible ? (
				<SyncRevertButton entry={entry} onStart={onRevert} />
			) : null}
			{undone ? null : (
				<UnmergeAction entry={entry} decideEnabled={decideEnabled} />
			)}
		</li>
	);
}

export function SyncJournal() {
	const [reverting, setReverting] = useState<SyncJournalEntry | null>(null);
	const status = useUkmaDataStatusRetrieve(NO_RETRY);
	const decideEnabled =
		status.data?.decide_scopes.includes("review:decide") ?? false;
	const journal = useInfiniteQuery({
		queryKey: [JOURNAL_QUERY_KEY],
		queryFn: ({ pageParam, signal }) => {
			const params: UkmaDataSyncJournalParams = { limit: PAGE_SIZE };
			if (pageParam.length > 0) {
				params.before = pageParam;
			}
			return ukmaDataSyncJournal(params, signal);
		},
		initialPageParam: "",
		getNextPageParam: (last) => last.next_before ?? undefined,
		retry: false,
	});
	const entries = journal.data?.pages.flatMap((page) => page.items) ?? [];
	const undone = undoneMergeIds(entries);
	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				Усі рішення на сайті і в UKMA Data, новіші вгорі.
			</p>
			{journal.isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
			{journal.error ? (
				<UkmaDataError
					error={journal.error}
					title="Не вдалося завантажити журнал"
					onRetry={() => void journal.refetch()}
					isRetrying={journal.isRefetching}
				/>
			) : null}
			{journal.data && !journal.error && entries.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<History />
						</EmptyMedia>
						<EmptyTitle>Ще не було жодного рішення.</EmptyTitle>
						<EmptyDescription>
							Застосування, відхилення й відкати з'являться тут.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{entries.length > 0 ? (
				<>
					<ul
						aria-label="Журнал"
						className="divide-y rounded-xl border bg-card"
					>
						{entries.map((entry) => (
							<JournalRow
								key={`${entry.kind}-${entry.id}`}
								entry={entry}
								onRevert={setReverting}
								decideEnabled={decideEnabled}
								undone={undone.has(entry.id)}
							/>
						))}
					</ul>
					{journal.hasNextPage ? (
						<div className="flex justify-end">
							<Button
								variant="outline"
								size="sm"
								onClick={() => void journal.fetchNextPage()}
								disabled={journal.isFetchingNextPage}
							>
								Ще 20
							</Button>
						</div>
					) : null}
				</>
			) : null}
			{reverting === null ? null : (
				<SyncRevertDialog
					entry={reverting}
					onClose={() => setReverting(null)}
				/>
			)}
		</div>
	);
}
