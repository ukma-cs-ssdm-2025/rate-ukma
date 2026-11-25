import { parseAsString, parseAsStringEnum } from "nuqs";

import { URL_OPTIONS } from "./syncParams";
import { REVIEW_STEPS } from "./syncSteps";

export const reviewStepParser = parseAsStringEnum([...REVIEW_STEPS])
	.withDefault("links")
	.withOptions(URL_OPTIONS);

export const reviewFieldParser = parseAsString.withOptions({
	...URL_OPTIONS,
	history: "replace",
});
