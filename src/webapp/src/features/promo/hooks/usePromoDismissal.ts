import { useCallback, useState } from "react";

import { localStorageAdapter } from "@/lib/storage";

const PROMO_DISMISSED_STORAGE_KEY = "rate-ukma-promo-dismissed";

/**
 * Remembers which promo the user closed.
 *
 * Stores the dismissed promo's `id` rather than a boolean so that bumping the
 * id resurfaces the banner for everyone. The stored value
 * is read in a lazy initialiser (not an effect) so a dismissed banner never
 * flashes on mount.
 */
export function usePromoDismissal(promoId: string) {
	const [dismissedId, setDismissedId] = useState<string | null>(() =>
		localStorageAdapter.getItem<string>(PROMO_DISMISSED_STORAGE_KEY),
	);

	const dismiss = useCallback(() => {
		localStorageAdapter.setItem(PROMO_DISMISSED_STORAGE_KEY, promoId);
		setDismissedId(promoId);
	}, [promoId]);

	return { isDismissed: dismissedId === promoId, dismiss };
}
