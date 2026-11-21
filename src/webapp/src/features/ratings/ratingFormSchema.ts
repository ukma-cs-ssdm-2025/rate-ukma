import * as z from "zod";

export const ratingSchema = z.object({
	difficulty: z
		.number()
		.min(1, "Оцініть складність")
		.max(5, "Оцінка складності повинна бути від 1 до 5"),
	usefulness: z
		.number()
		.min(1, "Оцініть корисність")
		.max(5, "Оцінка корисності повинна бути від 1 до 5"),
	comment: z
		.string()
		.transform((val) => val?.trim() || undefined)
		.optional(),
	instructor_ids: z.array(z.string().uuid()),
	instructor: z.string().max(256).optional(),
	is_anonymous: z.boolean(),
});

export type RatingFormData = z.infer<typeof ratingSchema>;
