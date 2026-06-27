import type { PropsWithChildren } from "react";
import { createContext, useEffect, useMemo, useRef, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth";
import {
	FEATURE_FLAG_OVERRIDES_EVENT,
	FEATURE_FLAG_OVERRIDES_STORAGE_KEY,
	installFeatureFlagConsoleHelpers,
	readFeatureFlagOverrides,
} from "./overrides";
import { getFlagsListQueryKey, useFlagsList } from "../api/generated";

export interface FeatureFlagsState {
	flags: Record<string, boolean>;
	isReady: boolean;
}

const FLAGS_STALE_TIME = 60_000;
const FLAGS_REFETCH_INTERVAL = 5 * 60_000;

const FeatureFlagsContext = createContext<FeatureFlagsState | null>(null);

export function FeatureFlagsProvider({ children }: PropsWithChildren) {
	const queryClient = useQueryClient();
	const { status, user } = useAuth();
	const userId = user?.id ?? null;

	const { data, isSuccess, isError } = useFlagsList({
		query: {
			staleTime: FLAGS_STALE_TIME,
			refetchInterval: FLAGS_REFETCH_INTERVAL,
			refetchOnWindowFocus: true,
		},
	});

	// Flags are evaluated per request user. When the identity changes (anonymous
	// <-> authenticated, or user A -> user B) drop the cached flags immediately so
	// we never serve the previous user's values while the new request is in
	// flight; the mounted query then refetches for the new identity. Skip the
	// initial mount — the query already fetches on mount.
	const isInitialIdentity = useRef(true);
	// biome-ignore lint/correctness/useExhaustiveDependencies: act only when the auth identity (status/userId) changes
	useEffect(() => {
		if (isInitialIdentity.current) {
			isInitialIdentity.current = false;
			return;
		}
		queryClient.removeQueries({ queryKey: getFlagsListQueryKey() });
	}, [status, userId, queryClient]);

	const [overrides, setOverrides] = useState<Record<string, boolean>>(
		readFeatureFlagOverrides,
	);

	useEffect(() => {
		installFeatureFlagConsoleHelpers();
		const refresh = () => setOverrides(readFeatureFlagOverrides());
		const onStorage = (e: StorageEvent) => {
			if (e.key === FEATURE_FLAG_OVERRIDES_STORAGE_KEY) refresh();
		};
		globalThis.addEventListener(FEATURE_FLAG_OVERRIDES_EVENT, refresh);
		globalThis.addEventListener("storage", onStorage);
		return () => {
			globalThis.removeEventListener(FEATURE_FLAG_OVERRIDES_EVENT, refresh);
			globalThis.removeEventListener("storage", onStorage);
		};
	}, []);

	const value = useMemo<FeatureFlagsState>(
		() => ({
			// Client overrides win over the server response (non-live only).
			flags: { ...(data?.flags ?? {}), ...overrides },
			// Ready once the first request settles (success OR error) so consumers
			// behind the isReady gate fall back to default-disabled flags instead of
			// getting stuck on a failed fetch.
			isReady: isSuccess || isError,
		}),
		[data, isSuccess, isError, overrides],
	);

	return (
		<FeatureFlagsContext.Provider value={value}>
			{children}
		</FeatureFlagsContext.Provider>
	);
}

export { FeatureFlagsContext };
