import { useCallback, useState } from "react";

import { localStorageAdapter } from "@/lib/storage";

const PROMO_DISMISSED_STORAGE_KEY = "rate-ukma-promo-dismissed";

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
