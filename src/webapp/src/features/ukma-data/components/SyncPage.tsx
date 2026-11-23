import { useQueryState } from "nuqs";

import { SYNC_TABS, tabParser } from "../syncParams";
import { DataSegments } from "./DataBits";
import { SyncHistoryTab } from "./SyncHistoryTab";
import { SyncPendingTab } from "./SyncPendingTab";
import { SyncRulesTab } from "./SyncRulesTab";

const TAB_LABELS = {
	pending: "Чекають рішення",
	history: "Журнал",
	rules: "Правила",
} satisfies Record<(typeof SYNC_TABS)[number], string>;

export function SyncPage() {
	const [tab, setTab] = useQueryState("tab", tabParser);
	return (
		<div className="min-w-0 space-y-6">
			<DataSegments
				tabs
				label="Вкладки оновлень"
				value={tab}
				onChange={(value) => void setTab(value)}
				items={SYNC_TABS.map((item) => ({
					value: item,
					label: TAB_LABELS[item],
				}))}
			/>
			{tab === "pending" ? <SyncPendingTab /> : null}
			{tab === "history" ? <SyncHistoryTab /> : null}
			{tab === "rules" ? <SyncRulesTab /> : null}
		</div>
	);
}
