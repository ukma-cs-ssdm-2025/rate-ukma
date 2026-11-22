import { useQueryStates } from "nuqs";

import type { SyncChangeGroupEnum } from "@/lib/api/generated";
import { useUkmaDataSyncPendingList } from "@/lib/api/generated";
import { formatCount } from "../syncFormat";
import { viewParams } from "../syncParams";
import { tableRow } from "../syncRows";
import { DataBack, DataPager, DataViewHead } from "./DataBits";
import {
	DataSearch,
	DataTableEmpty,
	DataTableFrame,
	DataTableSkeleton,
	DataTd,
	DataTh,
	DataTitleCell,
} from "./DataTable";
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
	run,
	scope,
	action,
	onBack,
}: Readonly<{
	title: string;
	description: string;
	run: number;
	scope: ChangeListScope;
	action?: React.ReactNode;
	onBack: () => void;
}>) {
	const [{ q, page }, setParams] = useQueryStates(viewParams);
	const list = useUkmaDataSyncPendingList(
		{
			source: "catalog",
			run,
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
			<DataBack onBack={onBack}>Усі групи</DataBack>
			<DataViewHead title={title} action={action}>
				{description}
			</DataViewHead>
			<DataSearch
				value={q}
				placeholder="Пошук за назвою або кодом САЗ"
				onChange={(value) => void setParams({ q: value, page: null })}
				className="max-w-xl"
			/>
			{list.isLoading ? <DataTableSkeleton /> : null}
			{list.error ? (
				<UkmaDataError
					error={list.error}
					title="Не вдалося завантажити список"
					onRetry={() => void list.refetch()}
					isRetrying={list.isRefetching}
				/>
			) : null}
			{data && data.items.length === 0 ? (
				<DataTableEmpty>Нічого не знайдено</DataTableEmpty>
			) : null}
			{data && data.items.length > 0 ? (
				<>
					<DataTableFrame>
						<thead>
							<tr>
								<DataTh className="w-1/2">Дисципліна</DataTh>
								<DataTh className="hidden sm:table-cell">Семестр</DataTh>
								<DataTh className="hidden sm:table-cell">Код САЗ</DataTh>
								{scope.field ? <DataTh>Зміна</DataTh> : null}
							</tr>
						</thead>
						<tbody className="divide-y">
							{data.items.map((change) => {
								const row = tableRow(change, scope.field);
								return (
									<tr key={row.id}>
										<DataTd>
											<DataTitleCell
												title={row.title}
												detail={row.department}
											/>
											<p className="text-muted-foreground sm:hidden">
												{[row.semester, row.sazCode]
													.filter(Boolean)
													.join(" · ")}
											</p>
										</DataTd>
										<DataTd className="hidden sm:table-cell">
											{row.semester}
										</DataTd>
										<DataTd className="hidden tabular-nums sm:table-cell">
											{row.sazCode}
										</DataTd>
										{scope.field ? <DataTd>{row.change}</DataTd> : null}
									</tr>
								);
							})}
						</tbody>
					</DataTableFrame>
					<DataPager
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
