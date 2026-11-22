import { ArrowLeft, ChevronRight, History } from "lucide-react";
import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SyncRun } from "@/lib/api/generated";
import {
	useUkmaDataSyncRunChangesList,
	useUkmaDataSyncRunsList,
} from "@/lib/api/generated";
import { formatDateTime } from "../reviewCases";
import {
	ALL,
	countsSummary,
	PAGE_SIZE,
	RUN_STATUS_LABELS,
	runStatusVariant,
	SOURCE_LABELS,
	STATE_LABELS,
	SYNC_SOURCES,
	SYNC_STATES,
} from "../sync";
import { SyncChangeCard } from "./SyncChangeCard";
import { SyncPagination } from "./SyncPagination";
import { UkmaDataError } from "./UkmaDataError";

const runsParams = {
	source: parseAsStringEnum([...SYNC_SOURCES, ALL]).withDefault(ALL),
	page: parseAsInteger.withDefault(1),
};

const runParams = {
	run: parseAsInteger,
};

const changeParams = {
	state: parseAsStringEnum([...SYNC_STATES, ALL]).withDefault(ALL),
	page: parseAsInteger.withDefault(1),
};

const runsUrlKeys = { urlKeys: { page: "runsPage" } } as const;
const changeUrlKeys = {
	urlKeys: { page: "changesPage", state: "changesState" },
} as const;

function RunRow({
	run,
	onOpen,
}: Readonly<{ run: SyncRun; onOpen: () => void }>) {
	const counts = countsSummary(run.counts);
	return (
		<Card className="p-0">
			<button
				type="button"
				onClick={onOpen}
				aria-label={`Відкрити запуск ${run.id}`}
				className="flex w-full items-start justify-between gap-3 p-4 text-left transition-colors hover:bg-accent/50"
			>
				<div className="min-w-0 space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant={runStatusVariant(run.status)}>
							{RUN_STATUS_LABELS[run.status]}
						</Badge>
						<Badge variant="outline">{SOURCE_LABELS[run.source]}</Badge>
						<span className="text-sm text-muted-foreground">
							{formatDateTime(run.started_at)} —{" "}
							{run.finished_at ? formatDateTime(run.finished_at) : "триває"}
						</span>
					</div>
					{counts.length > 0 ? (
						<p className="text-sm text-muted-foreground">
							{counts.join(" · ")}
						</p>
					) : null}
					{run.error ? (
						<p className="text-sm text-destructive">{run.error}</p>
					) : null}
				</div>
				<ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
			</button>
		</Card>
	);
}

function RunChanges({ runId }: Readonly<{ runId: number }>) {
	const [{ state, page }, setParams] = useQueryStates(
		changeParams,
		changeUrlKeys,
	);
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataSyncRunChangesList(
			runId,
			{
				state: state === ALL ? undefined : state,
				page,
				page_size: PAGE_SIZE,
			},
			{ query: { retry: false } },
		);
	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Select
					value={state}
					onValueChange={(value) =>
						setParams({ state: changeParams.state.parse(value), page: 1 })
					}
				>
					<SelectTrigger aria-label="Стан зміни" className="w-full sm:w-52">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Усі стани</SelectItem>
						{SYNC_STATES.map((item) => (
							<SelectItem key={item} value={item}>
								{STATE_LABELS[item]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{data && !error ? (
					<p className="text-sm text-muted-foreground">Змін: {data.total}</p>
				) : null}
			</div>
			{isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
			{error ? (
				<UkmaDataError
					error={error}
					title="Не вдалося завантажити зміни запуску"
					onRetry={refetch}
					isRetrying={isRefetching}
				/>
			) : null}
			{data && !error && data.items.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<History />
						</EmptyMedia>
						<EmptyTitle>У запуску немає змін</EmptyTitle>
						<EmptyDescription>
							{state === ALL
								? "Запуск нічого не змінив."
								: "За цим станом змін немає."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{data && !error && data.items.length > 0 ? (
				<>
					<ul className="space-y-3" aria-label={`Зміни запуску ${runId}`}>
						{data.items.map((change) => (
							<li key={change.id}>
								<SyncChangeCard change={change} showState />
							</li>
						))}
					</ul>
					<SyncPagination
						page={data.page}
						totalPages={data.total_pages}
						nextPage={data.next_page}
						previousPage={data.previous_page}
						onPageChange={(next) => setParams({ page: next })}
					/>
				</>
			) : null}
		</div>
	);
}

export function SyncHistoryTab() {
	const [{ source, page }, setParams] = useQueryStates(runsParams, runsUrlKeys);
	const [selected, setSelected] = useQueryStates(
		{ ...runParams, ...changeParams },
		changeUrlKeys,
	);
	const openRun = (run: number | null) => {
		void setSelected({ run, state: null, page: null });
	};
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataSyncRunsList(
			{
				page,
				page_size: PAGE_SIZE,
				source: source === ALL ? undefined : source,
			},
			{ query: { retry: false } },
		);

	if (selected.run !== null) {
		return (
			<div className="space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<Button variant="ghost" size="sm" onClick={() => openRun(null)}>
						<ArrowLeft />
						Усі запуски
					</Button>
					<h2 className="text-lg font-semibold">Запуск {selected.run}</h2>
				</div>
				<RunChanges runId={selected.run} />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Select
					value={source}
					onValueChange={(value) =>
						setParams({ source: runsParams.source.parse(value), page: 1 })
					}
				>
					<SelectTrigger
						aria-label="Джерело запусків"
						className="w-full sm:w-52"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Усі джерела</SelectItem>
						{SYNC_SOURCES.map((item) => (
							<SelectItem key={item} value={item}>
								{SOURCE_LABELS[item]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{data && !error ? (
					<p className="text-sm text-muted-foreground">
						Запусків: {data.total}
					</p>
				) : null}
			</div>
			{isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
			{error ? (
				<UkmaDataError
					error={error}
					title="Не вдалося завантажити історію запусків"
					onRetry={refetch}
					isRetrying={isRefetching}
				/>
			) : null}
			{data && !error && data.items.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<History />
						</EmptyMedia>
						<EmptyTitle>Запусків ще немає</EmptyTitle>
						<EmptyDescription>
							Історія синхронізації зʼявиться після першого запуску.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{data && !error && data.items.length > 0 ? (
				<>
					<ul className="space-y-3" aria-label="Запуски синхронізації">
						{data.items.map((run) => (
							<li key={run.id}>
								<RunRow run={run} onOpen={() => openRun(run.id)} />
							</li>
						))}
					</ul>
					<SyncPagination
						page={data.page}
						totalPages={data.total_pages}
						nextPage={data.next_page}
						previousPage={data.previous_page}
						onPageChange={(next) => setParams({ page: next })}
					/>
				</>
			) : null}
		</div>
	);
}
