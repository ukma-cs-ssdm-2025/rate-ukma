import type { ReactNode } from "react";

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useCourseTerm } from "./course-term";
import { FeatureFlagsContext } from "./feature-flags/FeatureFlagsContext";

function withFlag(on: boolean) {
	return ({ children }: { children: ReactNode }) => (
		<FeatureFlagsContext.Provider
			value={{ flags: { fe_discipline_term: on }, isReady: true }}
		>
			{children}
		</FeatureFlagsContext.Provider>
	);
}

describe("useCourseTerm", () => {
	it("keeps «курс» while the flag is off", () => {
		const { result } = renderHook(useCourseTerm, { wrapper: withFlag(false) });
		expect(result.current("Про курс", "Про дисципліну")).toBe("Про курс");
	});

	it("says «дисципліна» once the flag is on", () => {
		const { result } = renderHook(useCourseTerm, { wrapper: withFlag(true) });
		expect(result.current("Про курс", "Про дисципліну")).toBe("Про дисципліну");
	});

	it("reads as off outside the flags provider", () => {
		const { result } = renderHook(useCourseTerm);
		expect(result.current("Про курс", "Про дисципліну")).toBe("Про курс");
	});
});
