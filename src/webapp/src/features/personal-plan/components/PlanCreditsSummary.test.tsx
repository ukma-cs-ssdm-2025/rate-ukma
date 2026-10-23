import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PlanSummary } from "../planRules";
import { PlanCreditsSummary } from "./PlanCreditsSummary";

function summary(overrides: Partial<PlanSummary>): PlanSummary {
	return {
		totalCredits: 150,
		compulsoryCredits: 100,
		profOrientedCredits: 30,
		electiveCredits: 20,
		backupCount: 0,
		...overrides,
	};
}

describe("PlanCreditsSummary", () => {
	it("shows what is left for the total and each rule", () => {
		render(<PlanCreditsSummary summary={summary({})} />);
		expect(screen.getByText("Ще 90 до 240")).toBeTruthy();
		expect(screen.getByText("Ще щонайменше 24")).toBeTruthy();
		expect(screen.getByText("Можна ще 5")).toBeTruthy();
	});

	it("marks met and broken rules", () => {
		render(
			<PlanCreditsSummary
				summary={summary({
					totalCredits: 240,
					profOrientedCredits: 60,
					electiveCredits: 28,
				})}
			/>,
		);
		expect(screen.getByText("Рівно 240").className).toContain("text-success");
		expect(screen.getByText("Вимогу виконано").className).toContain(
			"text-success",
		);
		expect(screen.getByText("Перевищено на 3").className).toContain(
			"text-destructive",
		);
	});
});
