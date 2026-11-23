import type { QueryClient } from "@tanstack/react-query";

export const SYNC_API_ROOT = "/api/v1/ukma-data/sync";
export const PREVIEW_QUERY_KEY = "ukma-data-sync-preview";
export const PREVIEW_ROWS_QUERY_KEY = "ukma-data-sync-preview-rows";
export const JOURNAL_QUERY_KEY = "ukma-data-sync-journal";
export const REVERT_CHECK_QUERY_KEY = "ukma-data-sync-revert-check";

const isServerSyncKey = (queryKey: readonly unknown[]): boolean =>
	typeof queryKey[0] === "string" && queryKey[0].startsWith(SYNC_API_ROOT);

export function invalidateSyncQueries(queryClient: QueryClient): void {
	void queryClient.invalidateQueries({
		predicate: (query) => isServerSyncKey(query.queryKey),
	});
	void queryClient.invalidateQueries({ queryKey: [JOURNAL_QUERY_KEY] });
	void queryClient.invalidateQueries({
		queryKey: [PREVIEW_QUERY_KEY],
		refetchType: "none",
	});
	void queryClient.invalidateQueries({
		queryKey: [PREVIEW_ROWS_QUERY_KEY],
		refetchType: "none",
	});
}
