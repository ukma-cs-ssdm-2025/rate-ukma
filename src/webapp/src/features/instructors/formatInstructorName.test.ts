import { describe, expect, it } from "vitest";

import {
	formatInstructorName,
	formatInstructorShortName,
} from "./formatInstructorName";

describe("formatInstructorName", () => {
	it("should order last, first, then patronymic", () => {
		expect(
			formatInstructorName({
				last_name: "Іваненко",
				first_name: "Іван",
				patronymic: "Петрович",
			}),
		).toBe("Іваненко Іван Петрович");
	});

	it("should omit a missing patronymic", () => {
		expect(
			formatInstructorName({
				last_name: "Іваненко",
				first_name: "Іван",
				patronymic: undefined,
			}),
		).toBe("Іваненко Іван");
	});

	it("should filter out blank name parts", () => {
		expect(formatInstructorName({ last_name: "", first_name: "Іван" })).toBe(
			"Іван",
		);
	});

	it("should format the trimmed shape embedded in a rating", () => {
		expect(
			formatInstructorName({
				last_name: "Глибовець",
				first_name: "Микола",
				patronymic: "Миколайович",
			}),
		).toBe("Глибовець Микола Миколайович");
	});
});

describe("formatInstructorShortName", () => {
	it("should keep the surname and shorten the rest to initials", () => {
		expect(
			formatInstructorShortName({
				last_name: "Демченко",
				first_name: "Олена",
				patronymic: "Петрівна",
			}),
		).toBe("Демченко О. П.");
	});

	it("should skip a missing patronymic", () => {
		expect(
			formatInstructorShortName({
				last_name: "Коваль",
				first_name: "Андрій",
				patronymic: "",
			}),
		).toBe("Коваль А.");
	});
});
