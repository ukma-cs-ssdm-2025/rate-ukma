import { describe, expect, it } from "vitest";

import { getContext, shouldRetryQuery } from "./RootProvider";

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

	describe("shouldRetryQuery", () => {
		it("never retries failures without an HTTP response (timeout, offline)", () => {
			expect(shouldRetryQuery(0, { code: "ECONNABORTED" })).toBe(false);
			expect(shouldRetryQuery(0, new TypeError("fetch failed"))).toBe(false);
			expect(shouldRetryQuery(0, null)).toBe(false);
		});

		it("never retries 401 or 403", () => {
			expect(shouldRetryQuery(0, { response: { status: 401 } })).toBe(false);
			expect(shouldRetryQuery(2, { response: { status: 403 } })).toBe(false);
		});

		it("retries 5xx up to three attempts, then stops", () => {
			const serverError = { response: { status: 502 } };

			expect([0, 1, 2].map((count) => shouldRetryQuery(count, serverError))).toEqual([
				true,
				true,
				true,
			]);
			expect(shouldRetryQuery(3, serverError)).toBe(false);
		});

		it("is wired as the queryClient retry default", () => {
			expect(getContext().queryClient.getDefaultOptions().queries?.retry).toBe(
				shouldRetryQuery,
			);
		});
	});
});
