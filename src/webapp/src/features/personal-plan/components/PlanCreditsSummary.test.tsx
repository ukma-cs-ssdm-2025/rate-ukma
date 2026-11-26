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

describe("PlanCreditsSummary boundaries (US-6.3)", () => {
	it("accepts exactly the minimum of profession-oriented credits", () => {
		render(
			<PlanCreditsSummary summary={summary({ profOrientedCredits: 54 })} />,
		);

		expect(screen.getByText("Вимогу виконано").className).toContain(
			"text-success",
		);
	});

	it("reports half a credit missing just below the minimum", () => {
		render(
			<PlanCreditsSummary summary={summary({ profOrientedCredits: 53.5 })} />,
		);

		expect(screen.getByText("Ще щонайменше 0.5").className).toContain(
			"text-muted-foreground",
		);
		expect(screen.queryByText("Вимогу виконано")).toBeNull();
	});

	it("allows exactly the maximum of free-choice credits without a warning", () => {
		render(<PlanCreditsSummary summary={summary({ electiveCredits: 25 })} />);

		expect(screen.getByText("Можна ще 0").className).not.toContain(
			"text-destructive",
		);
		expect(screen.queryByText(/Перевищено/)).toBeNull();
	});

	it("warns when free-choice credits go half a credit over the maximum", () => {
		render(<PlanCreditsSummary summary={summary({ electiveCredits: 25.5 })} />);

		expect(screen.getByText("Перевищено на 0.5").className).toContain(
			"text-destructive",
		);
	});

	it("shows half a credit left just below the programme total", () => {
		render(<PlanCreditsSummary summary={summary({ totalCredits: 239.5 })} />);

		expect(screen.getByText("Ще 0.5 до 240").className).toContain(
			"text-muted-foreground",
		);
	});

	it("warns when the programme total goes half a credit over 240", () => {
		render(<PlanCreditsSummary summary={summary({ totalCredits: 240.5 })} />);

		expect(screen.getByText("Понад 240 на 0.5").className).toContain(
			"text-destructive",
		);
	});
});
