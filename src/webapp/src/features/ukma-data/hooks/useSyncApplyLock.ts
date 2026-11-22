import { useContext } from "react";

import { useUkmaDataSyncApprovalsActive } from "@/lib/api/generated";
import { AuthContext } from "@/lib/auth/AuthContext";

const ACTIVE_POLL_MS = 3000;

export function useSyncApplyLock() {
	const query = useUkmaDataSyncApprovalsActive({
		query: {
			retry: false,
			refetchInterval: (current) =>
				current.state.data?.item ? ACTIVE_POLL_MS : false,
		},
	});
	const active = query.data?.item ?? null;
	return { active, locked: active !== null, query };
}

export function useCurrentEmail(): string | null {
	return useContext(AuthContext)?.user?.email ?? null;
}
