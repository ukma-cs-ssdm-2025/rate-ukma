import { History } from "lucide-react";
import { parseAsInteger, parseAsStringEnum, useQueryStates } from "nuqs";

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
import { useUkmaDataSyncRunChangesList } from "@/lib/api/generated";
import { ALL, SYNC_STATES } from "../sync";
import { PAGE_SIZE, STATE_LABELS } from "../syncLabels";
import { URL_OPTIONS } from "../syncParams";
import { SyncChangeCard } from "./SyncChangeCard";
import { SyncPagination } from "./SyncPagination";
import { UkmaDataError } from "./UkmaDataError";

const changeParams = {
	state: parseAsStringEnum([...SYNC_STATES, ALL])
		.withDefault(ALL)
		.withOptions(URL_OPTIONS),
	page: parseAsInteger.withDefault(1).withOptions(URL_OPTIONS),
};

const changeUrlKeys = {
	urlKeys: { page: "changesPage", state: "changesState" },
} as const;

export function SyncRunChanges({ runId }: Readonly<{ runId: number }>) {
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
