import { useInfiniteQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type {
	SyncChangeKindEnum,
	SyncSelectionGroupEnum,
} from "@/lib/api/generated";
import { ukmaDataSyncPendingList } from "@/lib/api/generated";
import { formatCount } from "../syncFormat";
import { PAGE_SIZE } from "../syncLabels";
import { PREVIEW_ROWS_QUERY_KEY } from "../syncQueries";
import { SyncChangeCard } from "./SyncChangeCard";

export function SyncPreviewRows({
	group,
	kind,
}: Readonly<{
	group: SyncSelectionGroupEnum;
	kind: SyncChangeKindEnum | null;
}>) {
	const rows = useInfiniteQuery({
		queryKey: [PREVIEW_ROWS_QUERY_KEY, group, kind],
		queryFn: ({ pageParam, signal }) =>
			ukmaDataSyncPendingList(
				{
					source: "catalog",
					group,
					kind: kind ?? undefined,
					page: pageParam,
					page_size: PAGE_SIZE,
				},
				signal,
			),
		initialPageParam: 1,
		getNextPageParam: (last) => last.next_page,
		retry: false,
		staleTime: 0,
		gcTime: 0,
	});
	const pages = rows.data?.pages ?? [];
	const items = pages.flatMap((page) => page.items);
	const total = pages[0]?.total ?? 0;
	if (rows.isLoading) {
		return <Skeleton className="h-64 rounded-xl" />;
	}
	if (rows.error) {
		return (
			<div className="space-y-2 rounded-lg border bg-card p-4">
				<p className="text-sm">Не вдалося завантажити.</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void rows.refetch()}
					disabled={rows.isRefetching}
				>
					Спробувати ще
				</Button>
			</div>
		);
	}
	if (items.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">Немає рядків для показу.</p>
		);
	}
	return (
		<div className="space-y-3">
			<ul className="space-y-3" aria-label="Зміни до перегляду">
				{items.map((change) => (
					<li key={change.id}>
						<SyncChangeCard change={change} />
					</li>
				))}
			</ul>
			<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
				<span className="tabular-nums">
					Показано {formatCount(items.length)} з {formatCount(total)}
				</span>
				{rows.hasNextPage ? (
					<Button
						variant="outline"
						size="sm"
						onClick={() => void rows.fetchNextPage()}
						disabled={rows.isFetchingNextPage}
					>
						Ще 20
					</Button>
				) : null}
			</div>
		</div>
	);
}
