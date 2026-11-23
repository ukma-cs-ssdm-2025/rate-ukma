import { parseAsInteger, parseAsStringEnum } from "nuqs";

import { SyncChangeStateEnum } from "@/lib/api/generated";

export const SYNC_TABS = ["pending", "history", "rules"] as const;

export const URL_OPTIONS = { history: "push" } as const;

export const tabParser = parseAsStringEnum([...SYNC_TABS])
	.withDefault("pending")
	.withOptions(URL_OPTIONS);

export const changeParams = {
	state: parseAsStringEnum([...Object.values(SyncChangeStateEnum), "all"])
		.withDefault("all")
		.withOptions(URL_OPTIONS),
	page: parseAsInteger.withDefault(1).withOptions(URL_OPTIONS),
};

export const changeUrlKeys = {
	urlKeys: { page: "changesPage", state: "changesState" },
} as const;
