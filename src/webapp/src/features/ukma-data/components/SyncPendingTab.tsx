import { Inbox } from "lucide-react";
import { useQueryStates } from "nuqs";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import { useUkmaDataSyncPendingList } from "@/lib/api/generated";
import { PAGE_SIZE } from "../syncLabels";
import { GROUP_ORDER, NO_RETRY } from "../syncOverview";
import { pendingParams } from "../syncParams";
import { TERMS } from "../syncTerms";
import { DataSegments } from "./DataBits";
import { SyncChangeCard } from "./SyncChangeCard";
import { SyncPagination } from "./SyncPagination";
import { SyncQuestionList } from "./SyncQuestionList";
import { Term } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

function Nothing() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Inbox />
				</EmptyMedia>
				<EmptyTitle>У цій групі нічого не чекає</EmptyTitle>
				<EmptyDescription>
					Нові зміни з'являться після наступного нічного читання САЗ.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

export function SyncPendingTab() {
	const [{ group, page }, setParams] = useQueryStates(pendingParams);
	const pending = useUkmaDataSyncPendingList(
		{ source: "catalog", group, page, page_size: PAGE_SIZE },
		NO_RETRY,
	);
	const counts = pending.data?.groups ?? {};
	const total = pending.data?.total ?? 0;
	return (
		<div className="space-y-4">
			<p className="text-sm text-muted-foreground">
				Зміни з останнього читання САЗ, які ще{" "}
				<Term name="waiting">чекають рішення</Term>. Номер зміни (#) назвіть
				Claude у <Term name="console" />, щоб застосувати чи відхилити її.
			</p>
			<DataSegments
				label="Групи змін"
				value={group}
				onChange={(value) => void setParams({ group: value, page: null })}
				items={GROUP_ORDER.map((item) => ({
					value: item,
					label: TERMS[item].label,
					count: counts[item] ?? 0,
				}))}
			/>
			<p className="text-sm">
				<Term name={group} />: {TERMS[group].hint}
			</p>
			{group === "mapping" ? <SyncQuestionList /> : null}
			{group !== "mapping" && pending.isLoading ? (
				<Skeleton className="h-64 rounded-xl" />
			) : null}
			{group !== "mapping" && pending.error ? (
				<UkmaDataError
					error={pending.error}
					title="Не вдалося завантажити зміни"
					onRetry={() => void pending.refetch()}
					isRetrying={pending.isRefetching}
				/>
			) : null}
			{group !== "mapping" && pending.data && total === 0 ? <Nothing /> : null}
			{group !== "mapping" && pending.data && total > 0 ? (
				<>
					<ul className="space-y-3" aria-label="Зміни, що чекають рішення">
						{pending.data.items.map((change) => (
							<li key={change.id}>
								<SyncChangeCard change={change} />
							</li>
						))}
					</ul>
					<SyncPagination
						page={pending.data.page}
						totalPages={pending.data.total_pages}
						nextPage={pending.data.next_page}
						previousPage={pending.data.previous_page}
						onPageChange={(next) => void setParams({ page: next })}
					/>
				</>
			) : null}
		</div>
	);
}
