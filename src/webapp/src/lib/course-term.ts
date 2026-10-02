import { useContext, useMemo } from "react";

import { FeatureFlagsContext } from "@/lib/feature-flags/FeatureFlagsContext";

/** Picks the «курс» wording or the «дисципліна» one. */
export type CourseTerm = <T>(course: T, discipline: T) => T;

/**
 * Whether the UI says «дисципліна» instead of «курс», behind
 * `fe_rate_flow`, together with the rate flow. The two words differ in gender, so callers pass both
 * whole phrases rather than swapping one noun. Outside the flags provider
 * (isolated component tests) it reads as off.
 */
export function useCourseTerm(): CourseTerm {
	const discipline =
		useContext(FeatureFlagsContext)?.flags.fe_rate_flow ?? false;
	return useMemo<CourseTerm>(
		() =>
			<T>(course: T, disciplineWording: T) =>
				discipline ? disciplineWording : course,
		[discipline],
	);
}
