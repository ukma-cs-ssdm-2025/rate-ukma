import { useQueryState } from "nuqs";

import { useUkmaDataSyncSummary } from "@/lib/api/generated";
import { pendingTotal } from "../syncGroups";
import { SYNC_TABS, tabParser } from "../syncParams";
import { DataSegments } from "./DataBits";
import { SyncActiveBanner } from "./SyncActiveBanner";
import { SyncHistoryTab } from "./SyncHistoryTab";
import { SyncPendingTab } from "./SyncPendingTab";
import { SyncRulesTab } from "./SyncRulesTab";

const TAB_LABELS = {
	pending: "Чекають рішення",
	history: "Історія",
	rules: "Правила",
} satisfies Record<(typeof SYNC_TABS)[number], string>;

export function SyncPage() {
	const [tab, setTab] = useQueryState("tab", tabParser);
	const summary = useUkmaDataSyncSummary(
		{ source: "catalog" },
		{ query: { retry: false } },
	);
	const waiting = summary.data ? pendingTotal(summary.data.groups) : null;
	return (
		<div className="min-w-0 space-y-6">
			<SyncActiveBanner />
			<DataSegments
				tabs
				label="Вкладки оновлень"
				value={tab}
				onChange={(value) => void setTab(value)}
				items={SYNC_TABS.map((item) => ({
					value: item,
					label: TAB_LABELS[item],
					count: item === "pending" && waiting !== null ? waiting : undefined,
				}))}
			/>
			{tab === "pending" ? <SyncPendingTab /> : null}
			{tab === "history" ? <SyncHistoryTab /> : null}
			{tab === "rules" ? <SyncRulesTab /> : null}
		</div>
	);
}
