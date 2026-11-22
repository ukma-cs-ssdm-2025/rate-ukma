import { useQueryState } from "nuqs";

import { cn } from "@/lib/utils";
import { SYNC_TABS, tabParser } from "../syncParams";
import { SyncActiveBanner } from "./SyncActiveBanner";
import { SyncHistoryTab } from "./SyncHistoryTab";
import { SyncReviewTab } from "./SyncReviewTab";
import { SyncRulesTab } from "./SyncRulesTab";

const TAB_LABELS = {
	review: "Розгляд",
	history: "Історія",
	rules: "Правила",
} satisfies Record<(typeof SYNC_TABS)[number], string>;

export function SyncPage() {
	const [tab, setTab] = useQueryState("tab", tabParser);
	return (
		<div className="min-w-0 space-y-4">
			<SyncActiveBanner />
			<div
				role="tablist"
				aria-label="Вкладки синхронізації"
				className="flex w-fit max-w-full gap-1 rounded-lg bg-muted p-1"
			>
				{SYNC_TABS.map((item) => (
					<button
						key={item}
						type="button"
						role="tab"
						aria-selected={tab === item}
						onClick={() => void setTab(item)}
						className={cn(
							"rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
							tab === item
								? "bg-background text-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						{TAB_LABELS[item]}
					</button>
				))}
			</div>
			{tab === "review" ? <SyncReviewTab /> : null}
			{tab === "history" ? <SyncHistoryTab /> : null}
			{tab === "rules" ? <SyncRulesTab /> : null}
		</div>
	);
}
