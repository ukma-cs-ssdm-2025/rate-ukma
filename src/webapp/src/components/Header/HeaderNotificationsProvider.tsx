import type { ComponentType } from "react";
import { createContext, useContext } from "react";

export interface HeaderNotifications {
	Bell: ComponentType;
	MobilePanel: ComponentType<{ onBack: () => void; onNavigate: () => void }>;
	MobileRow: ComponentType<{ onOpen: () => void }>;
}

const HeaderNotificationsContext = createContext<HeaderNotifications | null>(
	null,
);

export const HeaderNotificationsProvider = HeaderNotificationsContext.Provider;

export function useHeaderNotifications(): HeaderNotifications | null {
	return useContext(HeaderNotificationsContext);
}
