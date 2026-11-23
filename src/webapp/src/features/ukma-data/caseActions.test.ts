import { AxiosError } from "axios";
import { describe, expect, it } from "vitest";

import { caseActionError, DECISION_FAILED_TEXT } from "./caseActions";

const axiosError = (status: number | null, data?: unknown) => {
	const error = new AxiosError("test");
	if (status !== null) {
		Object.assign(error, { response: { status, data } });
	}
	return error;
};

describe("caseActionError", () => {
	it("shows the server's Ukrainian reason for a refusal", () => {
		expect(
			caseActionError(
				axiosError(409, { detail: "Справу вже закрито або вона неактуальна." }),
			),
		).toBe("Справу вже закрито або вона неактуальна.");
	});

	it.each([502, 504, null])(
		"never shows the raw detail of a lost answer (%s)",
		(status) => {
			expect(
				caseActionError(
					axiosError(status, { detail: "UKMA Data is unreachable." }),
				),
			).toBe(DECISION_FAILED_TEXT);
		},
	);
});
