import { Fragment } from "react";

import axios from "axios";

import {
	useUkmaDataReviewCasesList,
	useUkmaDataStatusRetrieve,
	useUkmaDataSyncSummary,
} from "@/lib/api/generated";
import {
	casesWaiting,
	NO_RETRY,
	openGroups,
	openLineTitle,
	PAGE,
} from "../reviewCases";
import { formatCount, freshnessText, pluralForm } from "../syncFormat";
import { pendingTotal } from "../syncGroups";
import { DataLead } from "./DataLead";
import { DataDoneLine, DataLines, DataLinesSkeleton } from "./DataLines";
import {
	CaseWaitingLine,
	IssueLine,
	LineSkeleton,
	SyncWaitingLine,
} from "./OverviewLines";
import { OverviewTech } from "./OverviewTech";
import { UkmaDataError } from "./UkmaDataError";

interface Entry {
	key: string;
	done: boolean;
	render: (primary: boolean) => React.ReactNode;
}

const isNotFound = (error: unknown): boolean =>
	axios.isAxiosError(error) && error.response?.status === 404;

const changesWaiting = (count: number): string =>
	`${formatCount(count)} ${pluralForm(count, { one: "зміна", few: "зміни", many: "змін" })} із САЗ ${pluralForm(count, { one: "чекає", few: "чекають", many: "чекають" })} рішення`;

function useSyncEntry(): Entry & { checkedAt: string | null } {
	const summary = useUkmaDataSyncSummary({ source: "catalog" }, NO_RETRY);
	const base = {
		key: "sync",
		checkedAt: summary.data?.run.finished_at ?? null,
	};
	if (summary.isLoading) {
		return { ...base, done: false, render: () => <LineSkeleton /> };
	}
	if (summary.error && isNotFound(summary.error)) {
		return {
			...base,
			done: true,
			render: () => (
				<DataDoneLine
					title="Зміни з САЗ ще не перевіряли"
					detail="Перша нічна перевірка покаже тут, що змінилось у САЗ."
				/>
			),
		};
	}
	if (summary.error || !summary.data) {
		return {
			...base,
			done: false,
			render: () => (
				<IssueLine
					error={summary.error}
					area="Зміни з САЗ"
					onRetry={() => void summary.refetch()}
				/>
			),
		};
	}
	const waiting = pendingTotal(summary.data.groups);
	return waiting === 0
		? {
				...base,
				done: true,
				render: () => (
					<DataDoneLine
						title="Зміни з САЗ: усе вирішено"
						detail="Нових змін немає. Наступна перевірка — завтра о 02:30."
					/>
				),
			}
		: {
				...base,
				done: false,
				render: (primary) => (
					<SyncWaitingLine title={changesWaiting(waiting)} primary={primary} />
				),
			};
}

function useCaseEntries(): Entry[] {
	const cases = useUkmaDataReviewCasesList(
		{ ...PAGE, status: "open" },
		NO_RETRY,
	);
	if (cases.isLoading) {
		return [{ key: "cases", done: false, render: () => <LineSkeleton /> }];
	}
	if (cases.error || !cases.data) {
		return [
			{
				key: "cases",
				done: false,
				render: () => (
					<IssueLine
						error={cases.error}
						area="Справи"
						onRetry={() => void cases.refetch()}
					/>
				),
			},
		];
	}
	const { data } = cases;
	if (data.has_more) {
		return [
			{
				key: "cases",
				done: false,
				render: (primary) => (
					<CaseWaitingLine
						kind={null}
						title={casesWaiting(data.total)}
						primary={primary}
					/>
				),
			},
		];
	}
	const groups = openGroups(data.items);
	if (groups.length === 0) {
		return [
			{
				key: "cases",
				done: true,
				render: () => (
					<DataDoneLine
						title="Справи: усе вирішено"
						detail="Відкритих справ немає. Нові з'являються після нічного читання САЗ."
					/>
				),
			},
		];
	}
	return groups.map((group) => ({
		key: `cases-${group.kind}`,
		done: false,
		render: (primary) => (
			<CaseWaitingLine
				kind={group.kind}
				title={openLineTitle(group.kind, group.count, group.oldest)}
				primary={primary}
			/>
		),
	}));
}

export function OverviewPage() {
	const status = useUkmaDataStatusRetrieve(NO_RETRY);
	const sync = useSyncEntry();
	const cases = useCaseEntries();
	if (status.isLoading) {
		return <DataLinesSkeleton />;
	}
	if (status.error || !status.data) {
		return (
			<UkmaDataError
				error={status.error}
				title="Не вдалося завантажити огляд"
				onRetry={() => void status.refetch()}
				isRetrying={status.isRefetching}
			/>
		);
	}
	const entries = [sync, ...cases];
	const waiting = entries.filter((entry) => !entry.done);
	const done = entries.filter((entry) => entry.done);
	return (
		<div className="min-w-0 space-y-6">
			<DataLead
				title="Що чекає на вас"
				subtitle={freshnessText(status.data.data_updated_at, sync.checkedAt)}
			/>
			<DataLines label="Що чекає рішення">
				{waiting.map((entry, index) => (
					<Fragment key={entry.key}>{entry.render(index === 0)}</Fragment>
				))}
				{done.map((entry) => (
					<Fragment key={entry.key}>{entry.render(false)}</Fragment>
				))}
			</DataLines>
			<OverviewTech status={status.data} />
		</div>
	);
}
