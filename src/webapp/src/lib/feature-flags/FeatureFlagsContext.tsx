import type { PropsWithChildren } from "react";
import { createContext, useEffect, useMemo, useState } from "react";

import {
	FEATURE_FLAG_OVERRIDES_EVENT,
	FEATURE_FLAG_OVERRIDES_STORAGE_KEY,
	installFeatureFlagConsoleHelpers,
	readFeatureFlagOverrides,
} from "./overrides";
import { useFlagsList } from "../api/generated";

export interface FeatureFlagsState {
	flags: Record<string, boolean>;
	isReady: boolean;
}

const FLAGS_STALE_TIME = 60_000;
const FLAGS_REFETCH_INTERVAL = 5 * 60_000;

const FeatureFlagsContext = createContext<FeatureFlagsState | null>(null);

export function FeatureFlagsProvider({ children }: PropsWithChildren) {
	const { data, isSuccess } = useFlagsList({
		query: {
			staleTime: FLAGS_STALE_TIME,
			refetchInterval: FLAGS_REFETCH_INTERVAL,
			refetchOnWindowFocus: true,
		},
	});

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
			isReady: isSuccess,
		}),
		[data, isSuccess, overrides],
	);

	return (
		<FeatureFlagsContext.Provider value={value}>
			{children}
		</FeatureFlagsContext.Provider>
	);
}

export { FeatureFlagsContext };
