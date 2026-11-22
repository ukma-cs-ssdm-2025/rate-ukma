import { Inbox } from "lucide-react";
import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs";

import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
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
import type { SyncChange, SyncRun } from "@/lib/api/generated";
import { useUkmaDataSyncPendingList } from "@/lib/api/generated";
import { formatDateTime } from "../reviewCases";
import {
	ALL,
	dataAgeSeconds,
	formatAge,
	GROUP_LABELS,
	KIND_LABELS,
	PAGE_SIZE,
	RUN_STATUS_LABELS,
	runStatusVariant,
	SOURCE_LABELS,
	SYNC_GROUPS,
	SYNC_SOURCES,
} from "../sync";
import { SyncChangeCard } from "./SyncChangeCard";
import { SyncPagination } from "./SyncPagination";
import { UkmaDataError } from "./UkmaDataError";

const pendingParams = {
	group: parseAsStringEnum([...SYNC_GROUPS, ALL]).withDefault(ALL),
	kind: parseAsStringEnum([...Object.keys(KIND_LABELS), ALL]).withDefault(ALL),
	page: parseAsInteger.withDefault(1),
};

function CurrentRuns({ runs }: Readonly<{ runs: SyncRun[] }>) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Поточні запуски</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 text-sm">
				{runs.length === 0 ? (
					<p className="text-muted-foreground">
						Ще немає успішних запусків синхронізації.
					</p>
				) : (
					<ul className="space-y-2" aria-label="Поточні запуски синхронізації">
						{runs.map((run) => {
							const age = dataAgeSeconds(run.data_updated_at);
							return (
								<li
									key={run.id}
									className="flex flex-wrap items-center gap-x-3 gap-y-1"
								>
									<Badge variant={runStatusVariant(run.status)}>
										{RUN_STATUS_LABELS[run.status]}
									</Badge>
									<span className="font-medium">
										{SOURCE_LABELS[run.source]}
									</span>
									<span className="text-muted-foreground">
										завершено{" "}
										{run.finished_at ? formatDateTime(run.finished_at) : "—"}
									</span>
									<span className="text-muted-foreground">
										дані UKMA Data{" "}
										{run.data_updated_at === null || age === null
											? "невідомі"
											: `${formatDateTime(run.data_updated_at)} (${formatAge(age)} тому)`}
									</span>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

function PendingFilters({
	group,
	kind,
	groups,
	kinds,
	onGroupChange,
	onKindChange,
}: Readonly<{
	group: string;
	kind: string;
	groups: { [key: string]: number } | undefined;
	kinds: { [key: string]: number } | undefined;
	onGroupChange: (value: string) => void;
	onKindChange: (value: string) => void;
}>) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row">
			<Select value={group} onValueChange={(value) => onGroupChange(value)}>
				<SelectTrigger aria-label="Група змін" className="w-full sm:w-56">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL}>Усі групи</SelectItem>
					{SYNC_GROUPS.map((item) => (
						<SelectItem key={item} value={item}>
							{GROUP_LABELS[item]}
							{groups?.[item] ? ` (${groups[item]})` : ""}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<Select value={kind} onValueChange={(value) => onKindChange(value)}>
				<SelectTrigger aria-label="Тип зміни" className="w-full sm:w-64">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={ALL}>Усі типи</SelectItem>
					{Object.entries(KIND_LABELS).map(([item, label]) => (
						<SelectItem key={item} value={item}>
							{label}
							{kinds?.[item] ? ` (${kinds[item]})` : ""}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}

function GroupedChanges({ changes }: Readonly<{ changes: SyncChange[] }>) {
	return (
		<div className="space-y-6">
			{SYNC_SOURCES.map((source) => {
				const sourceChanges = changes.filter((item) => item.source === source);
				if (sourceChanges.length === 0) {
					return null;
				}
				return (
					<section
						key={source}
						aria-label={SOURCE_LABELS[source]}
						className="space-y-3"
					>
						<h2 className="text-lg font-semibold">{SOURCE_LABELS[source]}</h2>
						{SYNC_GROUPS.map((group) => {
							const items = sourceChanges.filter(
								(item) => item.group === group,
							);
							if (items.length === 0) {
								return null;
							}
							return (
								<div key={group} className="space-y-2">
									<h3 className="flex items-center gap-2 text-sm font-medium">
										{GROUP_LABELS[group]}
										<Badge variant="secondary">
											{items.length}
											<span className="sr-only"> на цій сторінці</span>
										</Badge>
									</h3>
									<ul
										className="space-y-3"
										aria-label={`${SOURCE_LABELS[source]}: ${GROUP_LABELS[group]}`}
									>
										{items.map((change) => (
											<li key={change.id}>
												<SyncChangeCard change={change} />
											</li>
										))}
									</ul>
								</div>
							);
						})}
					</section>
				);
			})}
		</div>
	);
}

export function SyncPendingTab() {
	const [{ group, kind, page }, setParams] = useQueryStates(pendingParams);
	const { data, isLoading, error, refetch, isRefetching } =
		useUkmaDataSyncPendingList(
			{
				page,
				page_size: PAGE_SIZE,
				group: group === ALL ? undefined : group,
				kind: kind === ALL ? undefined : kind,
			},
			{ query: { retry: false } },
		);
	const filtered = group !== ALL || kind !== ALL;
	return (
		<div className="space-y-4">
			<CurrentRuns runs={data?.runs ?? []} />
			<PendingFilters
				group={group}
				kind={kind}
				groups={data?.groups}
				kinds={data?.kinds}
				onGroupChange={(value) =>
					setParams({ group: pendingParams.group.parse(value), page: 1 })
				}
				onKindChange={(value) =>
					setParams({ kind: pendingParams.kind.parse(value), page: 1 })
				}
			/>
			{data && !error ? (
				<p className="text-sm text-muted-foreground">
					{filtered
						? `Змін у вибірці: ${data.total}`
						: `Очікують підтвердження: ${data.total}`}
				</p>
			) : null}
			{isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
			{error ? (
				<UkmaDataError
					error={error}
					title="Не вдалося завантажити зміни"
					onRetry={refetch}
					isRetrying={isRefetching}
				/>
			) : null}
			{data && !error && data.items.length === 0 ? (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<Inbox />
						</EmptyMedia>
						<EmptyTitle>Немає змін, що очікують</EmptyTitle>
						<EmptyDescription>
							{filtered
								? "За цим фільтром нічого не очікує."
								: "Наступний запуск синхронізації додасть зміни сюди."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			) : null}
			{data && !error && data.items.length > 0 ? (
				<>
					<GroupedChanges changes={data.items} />
					<p className="text-sm text-muted-foreground">
						Підтвердження, відхилення й відповіді на питання зʼявляться
						наступним оновленням.
					</p>
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
