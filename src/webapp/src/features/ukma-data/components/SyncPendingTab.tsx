import { useState } from "react";

import axios from "axios";
import { CalendarClock } from "lucide-react";
import { useQueryStates } from "nuqs";

import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import type { SyncSummary } from "@/lib/api/generated";
import {
	useUkmaDataSyncRunApprovalsList,
	useUkmaDataSyncSummary,
} from "@/lib/api/generated";
import { useCurrentEmail } from "../hooks/useSyncApplyLock";
import type { ConfirmRequest, DoneBanner } from "../syncConfirm";
import { doneLines, openLines, pendingTotal } from "../syncGroups";
import type { GroupLine, SyncView } from "../syncGroups";
import {
	historyParams,
	tabParser,
	VIEW_RESET,
	viewParams,
} from "../syncParams";
import { linksRequest, removedRequest } from "../syncRequests";
import { DataLinesSkeleton } from "./DataLines";
import { SyncAllDone } from "./SyncAllDone";
import { SyncConfirmDialog } from "./SyncConfirmDialog";
import { SyncDoneBanner, SyncOverview } from "./SyncOverview";
import { SyncViews } from "./SyncViews";
import { UkmaDataError } from "./UkmaDataError";

const APPROVALS_PAGE = 50;

const isNotFound = (error: unknown): boolean =>
	axios.isAxiosError(error) && error.response?.status === 404;

function NeverRun() {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<CalendarClock />
				</EmptyMedia>
				<EmptyTitle>Порівняння з САЗ ще не запускалось</EmptyTitle>
				<EmptyDescription>
					Перша нічна перевірка покаже тут, що змінилось у САЗ.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function requestFor(
	line: GroupLine,
	summary: SyncSummary,
): ConfirmRequest | null {
	if (line.key === "links") {
		return linksRequest(summary.groups);
	}
	return line.key === "removed" ? removedRequest(summary.groups) : null;
}

function PendingBody({ summary }: Readonly<{ summary: SyncSummary }>) {
	const [params, setParams] = useQueryStates(viewParams);
	const [, setHistory] = useQueryStates({ tab: tabParser, ...historyParams });
	const [request, setRequest] = useState<ConfirmRequest | null>(null);
	const [banner, setBanner] = useState<DoneBanner | null>(null);
	const email = useCurrentEmail();
	const runId = summary.run.id;
	const approvals = useUkmaDataSyncRunApprovalsList(
		runId,
		{ page_size: APPROVALS_PAGE },
		{ query: { retry: false } },
	);
	const lines = openLines(summary.groups);
	const done = doneLines(summary.groups, approvals.data?.items ?? [], email);
	const open = (view: SyncView) => void setParams({ ...VIEW_RESET, view });
	const history = (run: number | null) =>
		void setHistory({ tab: "history", openRun: run });
	const finish = (next: DoneBanner) => {
		setRequest(null);
		setBanner(next);
		void setParams({ ...VIEW_RESET, view: null });
	};
	const action = (line: GroupLine) => {
		if (line.action.view !== null) {
			open(line.action.view);
			return;
		}
		setRequest(requestFor(line, summary));
	};
	return (
		<div className="space-y-6">
			{banner === null ? null : (
				<SyncDoneBanner
					banner={banner}
					onHistory={() => history(banner.runId)}
					onDismiss={() => setBanner(null)}
				/>
			)}
			{params.view === "overview" && lines.length === 0 ? (
				<SyncAllDone done={done} onHistory={history} />
			) : null}
			{params.view === "overview" && lines.length > 0 ? (
				<SyncOverview
					summary={summary}
					remaining={pendingTotal(summary.groups)}
					lines={lines}
					done={done}
					onAction={action}
					onOpen={open}
					onHistory={history}
				/>
			) : null}
			{params.view === "overview" ? null : (
				<SyncViews
					summary={summary}
					onBack={() => open("overview")}
					onConfirm={setRequest}
				/>
			)}
			{request === null ? null : (
				<SyncConfirmDialog
					request={request}
					run={runId}
					onClose={() => setRequest(null)}
					onDone={finish}
				/>
			)}
		</div>
	);
}

export function SyncPendingTab() {
	const summary = useUkmaDataSyncSummary(
		{ source: "catalog" },
		{ query: { retry: false } },
	);
	if (summary.isLoading) {
		return <DataLinesSkeleton />;
	}
	if (summary.error && isNotFound(summary.error)) {
		return <NeverRun />;
	}
	if (summary.error) {
		return (
			<UkmaDataError
				error={summary.error}
				title="Не вдалося завантажити зміни з САЗ"
				onRetry={() => void summary.refetch()}
				isRetrying={summary.isRefetching}
			/>
		);
	}
	return summary.data ? <PendingBody summary={summary.data} /> : null;
}
