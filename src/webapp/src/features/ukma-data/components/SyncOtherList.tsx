import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/Button";
import { useUkmaDataSyncPendingList } from "@/lib/api/generated";
import type { ConfirmRequest } from "../syncConfirm";
import { formatCount } from "../syncFormat";
import { otherChangeText } from "../syncOther";
import { viewParams } from "../syncParams";
import { otherRequest, otherSkipRequest } from "../syncRequests";
import { tableRow } from "../syncRows";
import { SyncBack, SyncPager, SyncViewHead } from "./SyncBits";
import { LIST_PAGE } from "./SyncChangeList";
import {
	SyncTableEmpty,
	SyncTableFrame,
	SyncTableSkeleton,
	SyncTd,
	SyncTh,
	SyncTitleCell,
} from "./SyncTable";
import { UkmaDataError } from "./UkmaDataError";

export function SyncOtherList({
	run,
	total,
	onBack,
	onConfirm,
}: Readonly<{
	run: number;
	total: number;
	onBack: () => void;
	onConfirm: (request: ConfirmRequest) => void;
}>) {
	const [{ page }, setParams] = useQueryStates(viewParams);
	const list = useUkmaDataSyncPendingList(
		{ source: "catalog", run, group: "other", page, page_size: LIST_PAGE },
		{ query: { retry: false } },
	);
	const data = list.data;
	const from = data ? (data.page - 1) * data.page_size + 1 : 0;
	return (
		<div className="space-y-5">
			<SyncBack onBack={onBack} />
			<SyncViewHead
				title="Інші зміни"
				action={
					<div className="flex flex-col gap-2 sm:flex-row">
						<Button
							size="lg"
							variant="outline"
							disabled={total === 0}
							onClick={() => onConfirm(otherSkipRequest(total))}
						>
							Пропустити
						</Button>
						<Button
							size="lg"
							disabled={total === 0}
							onClick={() => onConfirm(otherRequest(total))}
						>
							Застосувати всі {formatCount(total)}
						</Button>
					</div>
				}
			>
				Зміни з САЗ, що не належать до жодної групи. Кожна зміниться на сайті
				так, як описано в рядку.
			</SyncViewHead>
			{list.isLoading ? <SyncTableSkeleton /> : null}
			{list.error ? (
				<UkmaDataError
					error={list.error}
					title="Не вдалося завантажити список"
					onRetry={() => void list.refetch()}
					isRetrying={list.isRefetching}
				/>
			) : null}
			{data && data.items.length === 0 ? (
				<SyncTableEmpty>Нічого не знайдено</SyncTableEmpty>
			) : null}
			{data && data.items.length > 0 ? (
				<>
					<SyncTableFrame>
						<thead>
							<tr>
								<SyncTh className="w-1/2">Дисципліна</SyncTh>
								<SyncTh>Що зміниться</SyncTh>
							</tr>
						</thead>
						<tbody className="divide-y">
							{data.items.map((change) => {
								const row = tableRow(change, null);
								return (
									<tr key={row.id}>
										<SyncTd>
											<SyncTitleCell
												title={row.title || "Без назви"}
												detail={row.department}
											/>
										</SyncTd>
										<SyncTd>{otherChangeText(change.kind)}</SyncTd>
									</tr>
								);
							})}
						</tbody>
					</SyncTableFrame>
					<SyncPager
						summary={`${formatCount(from)}–${formatCount(from + data.items.length - 1)} з ${formatCount(data.total)}`}
						page={data.page}
						totalPages={data.total_pages}
						onPage={(next) => void setParams({ page: next })}
					/>
				</>
			) : null}
		</div>
	);
}
