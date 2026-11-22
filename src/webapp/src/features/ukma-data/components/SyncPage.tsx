import { parseAsStringEnum, useQueryState } from "nuqs";

import { cn } from "@/lib/utils";
import { SyncHistoryTab } from "./SyncHistoryTab";
import { SyncPendingTab } from "./SyncPendingTab";
import { SyncRulesTab } from "./SyncRulesTab";

const TABS = ["pending", "history", "rules"] as const;

const TAB_LABELS = {
	pending: "Очікують",
	history: "Історія",
	rules: "Правила",
} satisfies Record<(typeof TABS)[number], string>;

const tabParser = parseAsStringEnum([...TABS]).withDefault("pending");

export function SyncPage() {
	const [tab, setTab] = useQueryState("tab", tabParser);
	return (
		<div className="space-y-4">
			<div
				role="tablist"
				aria-label="Вкладки синхронізації"
				className="flex w-fit gap-1 rounded-lg bg-muted p-1"
			>
				{TABS.map((item) => (
					<button
						key={item}
						type="button"
						role="tab"
						aria-selected={tab === item}
						onClick={() => setTab(item)}
						className={cn(
							"rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
							tab === item
								? "bg-background text-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{TAB_LABELS[item]}
					</button>
				))}
			</div>
			{tab === "pending" ? <SyncPendingTab /> : null}
			{tab === "history" ? <SyncHistoryTab /> : null}
			{tab === "rules" ? <SyncRulesTab /> : null}
		</div>
	);
}
