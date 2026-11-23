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
import { ukmaDataSyncJournal } from "@/lib/api/generated";
import { journalEntryNumber, journalTitle } from "../syncActions";
import { PAGE_SIZE } from "../syncLabels";
import { SyncRevertAction } from "./SyncRevertDialog";
import { Ago } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

function JournalRow({
	entry,
	onReverted,
}: Readonly<{
	entry: SyncJournalEntry;
	onReverted: () => void;
}>) {
	const reason =
		entry.kind === "apply" && !entry.revertible && !entry.reverted
			? entry.revert_reason
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
			</div>
			<span className="shrink-0 text-muted-foreground">
				{entry.who ?? "—"}, <Ago iso={entry.when} />
			</span>
			{entry.revertible ? (
				<SyncRevertAction entry={entry} onReverted={onReverted} />
			) : null}
		</li>
	);
}

export function SyncJournal() {
	const journal = useInfiniteQuery({
		queryKey: ["ukma-data-sync-journal"],
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
	const onReverted = () => void journal.refetch();
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
								onReverted={onReverted}
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
		</div>
	);
}
