import { parseAsStringEnum } from "nuqs";

import {
	SyncChangeKindEnum,
	SyncSelectionGroupEnum,
} from "@/lib/api/generated";
import { URL_OPTIONS } from "./syncParams";

export const previewGroupParser = parseAsStringEnum(
	Object.values(SyncSelectionGroupEnum),
)
	.withDefault("new")
	.withOptions(URL_OPTIONS);

export const previewKindParser = parseAsStringEnum(
	Object.values(SyncChangeKindEnum),
).withOptions(URL_OPTIONS);
