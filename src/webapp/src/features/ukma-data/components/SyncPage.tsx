import { useQueryState } from "nuqs";

import { useUkmaDataSyncSummary } from "@/lib/api/generated";
import { cn } from "@/lib/utils";
import { formatCount } from "../syncFormat";
import { pendingTotal } from "../syncGroups";
import { SYNC_TABS, tabParser } from "../syncParams";
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
			<div
				role="tablist"
				aria-label="Вкладки оновлень"
				className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1"
			>
				{SYNC_TABS.map((item) => (
					<button
						key={item}
						type="button"
						role="tab"
						aria-selected={tab === item}
						onClick={() => void setTab(item)}
						className={cn(
							"flex shrink-0 items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
							tab === item
								? "bg-background text-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{TAB_LABELS[item]}
						{item === "pending" && waiting !== null ? (
							<span className="font-normal text-muted-foreground tabular-nums">
								{formatCount(waiting)}
							</span>
						) : null}
					</button>
				))}
			</div>
			{tab === "pending" ? <SyncPendingTab /> : null}
			{tab === "history" ? <SyncHistoryTab /> : null}
			{tab === "rules" ? <SyncRulesTab /> : null}
		</div>
	);
}
