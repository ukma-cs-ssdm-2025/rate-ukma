import { useQueryStates } from "nuqs";

import type { SyncChangeGroupEnum } from "@/lib/api/generated";
import { useUkmaDataSyncPendingList } from "@/lib/api/generated";
import { formatCount } from "../syncFormat";
import { viewParams } from "../syncParams";
import { tableRow } from "../syncRows";
import { SyncBack, SyncPager, SyncViewHead } from "./SyncBits";
import {
	SyncSearch,
	SyncTableEmpty,
	SyncTableFrame,
	SyncTableSkeleton,
	SyncTd,
	SyncTh,
	SyncTitleCell,
} from "./SyncTable";
import { UkmaDataError } from "./UkmaDataError";

export const LIST_PAGE = 12;

export interface ChangeListScope {
	group: SyncChangeGroupEnum;
	field: string | null;
	blanks: boolean | null;
}

export function SyncChangeList({
	title,
	description,
	scope,
	action,
	onBack,
}: Readonly<{
	title: string;
	description: string;
	scope: ChangeListScope;
	action?: React.ReactNode;
	onBack: () => void;
}>) {
	const [{ q, page }, setParams] = useQueryStates(viewParams);
	const list = useUkmaDataSyncPendingList(
		{
			source: "catalog",
			group: scope.group,
			changed_field: scope.field ?? undefined,
			blanks: scope.blanks ?? undefined,
			q: q || undefined,
			page,
			page_size: LIST_PAGE,
		},
		{ query: { retry: false } },
	);
	const data = list.data;
	const from = data ? (data.page - 1) * data.page_size + 1 : 0;
	return (
		<div className="space-y-5">
			<SyncBack onBack={onBack} />
			<SyncViewHead title={title} action={action}>
				{description}
			</SyncViewHead>
			<SyncSearch
				value={q}
				placeholder="Пошук за назвою або кодом САЗ"
				onChange={(value) => void setParams({ q: value, page: null })}
				className="max-w-xl"
			/>
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
								<SyncTh className="hidden sm:table-cell">Семестр</SyncTh>
								<SyncTh className="hidden sm:table-cell">Код САЗ</SyncTh>
								{scope.field ? <SyncTh>Зміна</SyncTh> : null}
							</tr>
						</thead>
						<tbody className="divide-y">
							{data.items.map((change) => {
								const row = tableRow(change, scope.field);
								return (
									<tr key={row.id}>
										<SyncTd>
											<SyncTitleCell
												title={row.title}
												detail={row.department}
											/>
											<p className="text-muted-foreground sm:hidden">
												{[row.semester, row.sazCode]
													.filter(Boolean)
													.join(" · ")}
											</p>
										</SyncTd>
										<SyncTd className="hidden sm:table-cell">
											{row.semester}
										</SyncTd>
										<SyncTd className="hidden tabular-nums sm:table-cell">
											{row.sazCode}
										</SyncTd>
										{scope.field ? <SyncTd>{row.change}</SyncTd> : null}
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
