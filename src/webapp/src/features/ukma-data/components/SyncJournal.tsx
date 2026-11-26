import { useState } from "react";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronDown, History } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import type {
	SyncJournalEntry,
	UkmaDataSyncJournalParams,
} from "@/lib/api/generated";
import {
	ukmaDataSyncJournal,
	ukmaDataSyncRunChangesList,
	useUkmaDataStatusRetrieve,
} from "@/lib/api/generated";
import { undoneMergeIds } from "../caseActions";
import { journalItems } from "../journalBatches";
import {
	journalEntryNumber,
	journalNote,
	journalTitle,
	journalWho,
	decisionErrorText,
} from "../syncActions";
import { countWith, formatCount } from "../syncFormat";
import { PAGE_SIZE } from "../syncLabels";
import { NO_RETRY } from "../syncOverview";
import { JOURNAL_QUERY_KEY } from "../syncQueries";
import { KeyCheckError, UnmergeAction } from "./CaseActions";
import { SyncReviewRow } from "./SyncReviewRows";
import { SyncRevertButton, SyncRevertDialog } from "./SyncRevertDialog";
import { Ago } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

const CHANGES_PAGE = 20;

function JournalChanges({
	runId,
	approvalId,
}: Readonly<{ runId: number; approvalId: number }>) {
	const changes = useInfiniteQuery({
		queryKey: [JOURNAL_QUERY_KEY, "changes", approvalId],
		queryFn: ({ pageParam, signal }) =>
			ukmaDataSyncRunChangesList(
				runId,
				{ approval: approvalId, page: pageParam, page_size: CHANGES_PAGE },
				signal,
			),
		initialPageParam: 1,
		getNextPageParam: (last) => last.next_page,
		retry: false,
	});
	const items = changes.data?.pages.flatMap((page) => page.items) ?? [];
	const total = changes.data?.pages[0]?.total ?? 0;
	if (changes.isLoading) {
		return (
			<div className="space-y-2 border-t bg-muted/40 px-4 py-3 sm:px-5">
				<Skeleton className="h-4 w-1/2" />
				<Skeleton className="h-4 w-1/3" />
			</div>
		);
	}
	if (changes.error) {
		return (
			<div className="border-t bg-muted/40 px-4 py-3 text-sm sm:px-5">
				<p role="alert" className="text-destructive">
					Не вдалося завантажити записи.{" "}
					<Button
						variant="link"
						className="h-auto p-0"
						onClick={() => void changes.refetch()}
					>
						Спробувати ще
					</Button>
				</p>
			</div>
		);
	}
	if (items.length === 0) {
		return (
			<p className="border-t bg-muted/40 px-4 py-3 text-sm text-muted-foreground sm:px-5">
				Немає записів, повʼязаних із цим рішенням.
			</p>
		);
	}
	return (
		<div className="border-t bg-muted/40">
			<ul aria-label="Записи рішення" className="divide-y">
				{items.map((change) => (
					<SyncReviewRow
						key={change.id}
						change={change}
						selectable={false}
						included
						onToggle={() => undefined}
					/>
				))}
			</ul>
			<div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-sm text-muted-foreground sm:px-5">
				<span className="tabular-nums">
					Показано {formatCount(items.length)} з {formatCount(total)}
				</span>
				{changes.hasNextPage ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => void changes.fetchNextPage()}
						disabled={changes.isFetchingNextPage}
					>
						{changes.isFetchingNextPage ? <Spinner /> : null}
						Показати ще
					</Button>
				) : null}
			</div>
		</div>
	);
}

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
	const [open, setOpen] = useState(false);
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
	const note = journalNote(entry);
	const listable =
		(entry.kind === "apply" || entry.kind === "reject") &&
		entry.run_id !== null &&
		entry.approval_id !== null &&
		(entry.counts.applied ?? 0) + (entry.counts.rejected ?? 0) > 0;
	const number = journalEntryNumber(entry);
	return (
		<li className="text-sm">
			<div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
				<div className="min-w-0 flex-1 space-y-0.5">
					<p className="break-words">
						{journalTitle(entry)}
						{entry.reverted ? (
							<span className="text-muted-foreground">, відкочено</span>
						) : null}
					</p>
					<p className="text-muted-foreground">
						{journalWho(entry)}, <Ago iso={entry.when} />
						{number === "—" ? null : `, ${number}`}
					</p>
					{note.length > 0 ? (
						<p className="text-muted-foreground">{note}</p>
					) : null}
					{reason.length > 0 ? (
						<p className="text-muted-foreground">{reason}</p>
					) : null}
					{decisionError.length > 0 ? (
						<p className="text-muted-foreground">{decisionError}</p>
					) : null}
				</div>
				<div className="flex shrink-0 flex-wrap gap-2">
					{listable ? (
						<Button
							variant="ghost"
							size="sm"
							aria-expanded={open}
							onClick={() => setOpen((current) => !current)}
						>
							Що саме
							<ChevronDown
								className={cn(
									"transition-transform duration-200",
									open && "rotate-180",
								)}
							/>
						</Button>
					) : null}
					{entry.revertible ? (
						<SyncRevertButton entry={entry} onStart={onRevert} />
					) : null}
					{undone ? null : (
						<UnmergeAction entry={entry} decideEnabled={decideEnabled} />
					)}
				</div>
			</div>
			{open && entry.run_id !== null && entry.approval_id !== null ? (
				<JournalChanges runId={entry.run_id} approvalId={entry.approval_id} />
			) : null}
		</li>
	);
}

const PARTS = { one: "частину", few: "частини", many: "частин" };

function JournalBatch({
	head,
	parts,
	onRevert,
	decideEnabled,
}: Readonly<{
	head: SyncJournalEntry;
	parts: readonly SyncJournalEntry[];
	onRevert: (entry: SyncJournalEntry) => void;
	decideEnabled: boolean;
}>) {
	const [open, setOpen] = useState(false);
	const note = journalNote(head);
	return (
		<li className="text-sm">
			<div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
				<div className="min-w-0 flex-1 space-y-0.5">
					<p className="break-words">
						{journalTitle(head)}, за {countWith(parts.length, PARTS)}
						{head.reverted ? (
							<span className="text-muted-foreground">, відкочено</span>
						) : null}
					</p>
					<p className="text-muted-foreground">
						{journalWho(head)}, <Ago iso={head.when} />
					</p>
					{note.length > 0 ? (
						<p className="text-muted-foreground">{note}</p>
					) : null}
				</div>
				<Button
					variant="ghost"
					size="sm"
					className="shrink-0 self-start sm:self-center"
					aria-expanded={open}
					onClick={() => setOpen((current) => !current)}
				>
					Частини
					<ChevronDown
						className={cn(
							"transition-transform duration-200",
							open && "rotate-180",
						)}
					/>
				</Button>
			</div>
			{open ? (
				<ul
					aria-label="Частини застосування"
					className="divide-y border-t bg-muted/40"
				>
					{parts.map((part) => (
						<JournalRow
							key={part.id}
							entry={part}
							onRevert={onRevert}
							decideEnabled={decideEnabled}
							undone={false}
						/>
					))}
				</ul>
			) : null}
		</li>
	);
}

export function SyncJournal() {
	const [reverting, setReverting] = useState<SyncJournalEntry | null>(null);
	const status = useUkmaDataStatusRetrieve(NO_RETRY);
	const decideEnabled = status.data?.scopes.includes("review:decide") ?? false;
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
				Хто що вирішив: оновлення з САЗ, правила і справи UKMA Data. Новіші
				вгорі.
			</p>
			<KeyCheckError
				failed={status.isError}
				retrying={status.isFetching}
				onRetry={() => void status.refetch()}
			/>
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
						{journalItems(entries).map((item) =>
							item.kind === "batch" ? (
								<JournalBatch
									key={`batch-${item.head.id}`}
									head={item.head}
									parts={item.parts}
									onRevert={setReverting}
									decideEnabled={decideEnabled}
								/>
							) : (
								<JournalRow
									key={`${item.entry.kind}-${item.entry.id}`}
									entry={item.entry}
									onRevert={setReverting}
									decideEnabled={decideEnabled}
									undone={undone.has(item.entry.id)}
								/>
							),
						)}
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
