import { shortName } from "@/features/schedule/lib/format";
import {
	splitName,
	type SplitName,
} from "@/features/schedule/lib/calendar-events";

/** The ІНП title when one was resolved, shortened, else the parsed name. */
export const displayShort = (
	names: ReadonlyMap<string, string>,
	id: string,
	fallback: string,
): string => shortName(names.get(id) ?? fallback);

/** The same, split from its variant suffix for two-line presentations. */
export const displaySplit = (
	names: ReadonlyMap<string, string>,
	id: string,
	fallback: string,
): SplitName => splitName(names.get(id) ?? fallback);
