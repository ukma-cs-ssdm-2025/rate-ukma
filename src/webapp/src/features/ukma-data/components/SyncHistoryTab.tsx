import { parseAsInteger, useQueryState } from "nuqs";

import { URL_OPTIONS } from "../syncParams";
import { SyncJournal } from "./SyncJournal";
import { SyncRunPage } from "./SyncRunPage";

export function SyncHistoryTab() {
	const [openRun, setOpenRun] = useQueryState(
		"openRun",
		parseAsInteger.withOptions(URL_OPTIONS),
	);
	if (openRun !== null) {
		return <SyncRunPage runId={openRun} onBack={() => void setOpenRun(null)} />;
	}
	return <SyncJournal />;
}
