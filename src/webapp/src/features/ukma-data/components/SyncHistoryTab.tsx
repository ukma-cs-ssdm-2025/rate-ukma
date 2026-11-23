import { useQueryStates } from "nuqs";

import { changeParams, changeUrlKeys, historyParams } from "../syncParams";
import { SyncJournal } from "./SyncJournal";
import { SyncRunPage } from "./SyncRunPage";
import { SyncRunsList } from "./SyncRunsList";

export function SyncHistoryTab() {
	const [{ openRun }, setParams] = useQueryStates(
		{ ...historyParams, ...changeParams },
		changeUrlKeys,
	);
	const open = (run: number | null) => {
		void setParams({ openRun: run, state: null, page: null });
	};
	if (openRun !== null) {
		return <SyncRunPage runId={openRun} onBack={() => open(null)} />;
	}
	return (
		<div className="space-y-8">
			<SyncJournal />
			<SyncRunsList onOpen={open} />
		</div>
	);
}
