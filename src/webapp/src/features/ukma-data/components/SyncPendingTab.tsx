import { Inbox } from "lucide-react";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SyncSummary } from "@/lib/api/generated";
import { useUkmaDataSyncSummary } from "@/lib/api/generated";
import { NO_RETRY } from "../syncOverview";
import { inboxSteps } from "../syncSteps";
import { errorStatus } from "../ukmaDataErrors";
import { SyncStepList } from "./SyncStepList";
import { Ago } from "./Term";
import { UkmaDataError } from "./UkmaDataError";

function NothingWaits() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<Inbox />
				</EmptyMedia>
				<EmptyTitle>Нічого не чекає рішення</EmptyTitle>
				<EmptyDescription>Наступне читання САЗ уночі.</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function LastRead({ summary }: Readonly<{ summary: SyncSummary }>) {
	const iso = summary.run.data_updated_at ?? summary.run.finished_at;
	if (iso === null) {
		return null;
	}
	return (
		<p className="text-sm text-muted-foreground">
			САЗ прочитано <Ago iso={iso} />. Зміни застосовуйте згори донизу.
		</p>
	);
}

export function SyncPendingTab() {
	const summary = useUkmaDataSyncSummary({ source: "catalog" }, NO_RETRY);
	const steps = summary.data ? inboxSteps(summary.data) : [];
	const neverRead = errorStatus(summary.error) === 404;
	const failed = summary.error !== null && !neverRead;
	return (
		<div className="space-y-4">
			{summary.isLoading ? <Skeleton className="h-64 rounded-xl" /> : null}
			{neverRead ? <NothingWaits /> : null}
			{failed ? (
				<UkmaDataError
					error={summary.error}
					title="Не вдалося завантажити зміни"
					onRetry={() => void summary.refetch()}
					isRetrying={summary.isRefetching}
				/>
			) : null}
			{summary.data && !failed ? <LastRead summary={summary.data} /> : null}
			{summary.data && !failed && steps.length === 0 ? <NothingWaits /> : null}
			{steps.length > 0 && !failed ? <SyncStepList steps={steps} /> : null}
		</div>
	);
}
