import type { PropsWithChildren } from "react";
import { createContext, useMemo } from "react";

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

	const value = useMemo<FeatureFlagsState>(
		() => ({
			flags: data?.flags ?? {},
			isReady: isSuccess,
		}),
		[data, isSuccess],
	);

	return (
		<FeatureFlagsContext.Provider value={value}>
			{children}
		</FeatureFlagsContext.Provider>
	);
}

export { FeatureFlagsContext };
