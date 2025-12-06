import { describe, expect, it } from "vitest";

import { getContext } from "./RootProvider";

describe("RootProvider", () => {
	describe("getContext", () => {
		it("should return a queryClient with correct staleTime configuration", () => {
			const context = getContext();
			const defaultOptions = context.queryClient.getDefaultOptions();

			expect(defaultOptions.queries?.staleTime).toBe(5 * 60 * 1000); // 5 minutes
		});

		it("should return a fresh QueryClient instance each time", () => {
			const context1 = getContext();
			const context2 = getContext();

			expect(context1.queryClient).not.toBe(context2.queryClient);
		});
	});
});
