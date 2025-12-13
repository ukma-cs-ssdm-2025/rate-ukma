import { z } from "zod";

import { DIFFICULTY_RANGE, USEFULNESS_RANGE } from "./courseFormatting";

export const filterSchema = z.object({
	searchQuery: z.string(),
	difficultyRange: z
		.tuple([
			z.number().min(DIFFICULTY_RANGE[0]).max(DIFFICULTY_RANGE[1]),
			z.number().min(DIFFICULTY_RANGE[0]).max(DIFFICULTY_RANGE[1]),
		])
		.refine(([min, max]) => min <= max, {
			message: "Minimum difficulty must be less than or equal to maximum",
		}),
	usefulnessRange: z
		.tuple([
			z.number().min(USEFULNESS_RANGE[0]).max(USEFULNESS_RANGE[1]),
			z.number().min(USEFULNESS_RANGE[0]).max(USEFULNESS_RANGE[1]),
		])
		.refine(([min, max]) => min <= max, {
			message: "Minimum usefulness must be less than or equal to maximum",
		}),
	faculty: z.string(),
	department: z.string(),
	instructor: z.string(),
	semesterTerm: z.string(),
	semesterYear: z.string(),
	courseType: z.string(),
	speciality: z.string(),
	page: z.number().int().positive().default(1),
	page_size: z.number().int().positive().default(20),
});

export type FilterState = z.infer<typeof filterSchema>;

export const DEFAULT_FILTERS: FilterState = {
	searchQuery: "",
	difficultyRange: DIFFICULTY_RANGE,
	usefulnessRange: USEFULNESS_RANGE,
	faculty: "",
	department: "",
	instructor: "",
	semesterTerm: "",
	semesterYear: "",
	courseType: "",
	speciality: "",
	page: 1,
	page_size: 20,
};
