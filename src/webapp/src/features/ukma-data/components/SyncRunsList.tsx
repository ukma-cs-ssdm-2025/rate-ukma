import { ChevronRight, History } from "lucide-react";
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
import { useUkmaDataSyncRunsList } from "@/lib/api/generated";
import { ALL, countsSummary, runStatusVariant, SYNC_SOURCES } from "../sync";
import { PAGE_SIZE, RUN_STATUS_LABELS, SOURCE_LABELS } from "../syncLabels";
import { failedRunLabel } from "../syncReasons";
import { URL_OPTIONS } from "../syncParams";
import { SyncPagination } from "./SyncPagination";
import { Ago } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

const runsParams = {
	source: parseAsStringEnum([...SYNC_SOURCES, ALL])
		.withDefault(ALL)
		.withOptions(URL_OPTIONS),
	page: parseAsInteger.withDefault(1).withOptions(URL_OPTIONS),
};

const runsUrlKeys = { urlKeys: { page: "runsPage" } } as const;

function RunRow({
	run,
	onOpen,
}: Readonly<{ run: SyncRun; onOpen: () => void }>) {
	const counts = countsSummary(run.counts);
	return (
		<Card className="flex-row items-start justify-between gap-3 p-4">
			<div className="min-w-0 space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<Badge variant={runStatusVariant(run.status)}>
						{RUN_STATUS_LABELS[run.status]}
					</Badge>
					<Badge variant="outline">{SOURCE_LABELS[run.source]}</Badge>
					<span className="text-sm text-muted-foreground">
						{run.finished_at ? "завершилось " : "триває, почалось "}
						<Ago iso={run.finished_at ?? run.started_at} />
					</span>
				</div>
				{counts.length > 0 ? (
					<p className="text-sm text-muted-foreground">{counts.join(" · ")}</p>
				) : null}
				{run.error ? (
					<p className="text-sm text-destructive">
						{failedRunLabel(run.error)}
					</p>
				) : null}
			</div>
			<Button
				variant="ghost"
				size="sm"
				onClick={onOpen}
				aria-label={`Відкрити читання ${run.id}`}
				className="shrink-0"
			>
				Деталі
				<ChevronRight />
			</Button>
		</Card>
	);
}

export function SyncRunsList({
	onOpen,
}: Readonly<{ onOpen: (run: number) => void }>) {
	const [{ source, page }, setParams] = useQueryStates(runsParams, runsUrlKeys);
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataSyncRunsList(
			{
				page,
				page_size: PAGE_SIZE,
				source: source === ALL ? undefined : source,
			},
			{ query: { retry: false } },
		);

	return (
		<section aria-labelledby="sync-runs-title" className="space-y-4">
			<h3 id="sync-runs-title" className="text-base font-medium">
				Нічні читання САЗ
			</h3>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<Select
					value={source}
					onValueChange={(value) =>
						setParams({ source: runsParams.source.parse(value), page: 1 })
					}
				>
					<SelectTrigger aria-label="Джерело" className="w-full sm:w-52">
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
					<p className="text-sm text-muted-foreground">Читань: {data.total}</p>
				) : null}
			</div>
			{isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
			{error ? (
				<UkmaDataError
					error={error}
					title="Не вдалося завантажити історію читань"
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
						<EmptyTitle>Читань САЗ ще не було</EmptyTitle>
						<EmptyDescription>
							Історія з'явиться після першого нічного читання.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{data && !error && data.items.length > 0 ? (
				<>
					<ul className="space-y-3" aria-label="Читання САЗ">
						{data.items.map((run) => (
							<li key={run.id}>
								<RunRow run={run} onOpen={() => onOpen(run.id)} />
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
		</section>
	);
}
