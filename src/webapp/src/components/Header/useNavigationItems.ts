import { useFeatureFlags } from "@/lib/feature-flags";
import { type NavigationItem, navigationItems } from "./navigationData";

/** Navigation without the items whose feature flag is off. */
export function useNavigationItems(): NavigationItem[] {
	const { flags } = useFeatureFlags();
	return navigationItems.filter((item) => !item.flag || flags[item.flag]);
}
