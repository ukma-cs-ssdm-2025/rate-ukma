import { useFeatureFlags } from "@/lib/feature-flags/useFeatureFlag";
import { navigationItems } from "./navigationData";
import type { NavigationItem } from "./navigationData";

export function useNavigationItems(): NavigationItem[] {
	const { flags } = useFeatureFlags();
	return navigationItems.filter((item) => !item.flag || flags[item.flag]);
}
