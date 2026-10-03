import { z } from "zod";

import { useStudentsMeRatingSuggestionsList } from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";

const ratingSuggestionSchema = z.object({
	course_id: z.string().min(1),
	course_offering_id: z.string().min(1),
	course_title: z.string().min(1),
	semester: z.object({
		year: z.number().int(),
		season: z.enum(["FALL", "SPRING", "SUMMER"]),
	}),
	ratings_count: z.number().int().nonnegative(),
});

export type RatingSuggestion = z.infer<typeof ratingSuggestionSchema>;

const parseSuggestions = (data: unknown): RatingSuggestion[] =>
	z.array(ratingSuggestionSchema).parse(data);

export function useRatingSuggestions(excludeCourse?: string, enabled = true) {
	const { isStudent } = useAuth();
	return useStudentsMeRatingSuggestionsList(
		excludeCourse ? { exclude_course: excludeCourse } : undefined,
		{ query: { enabled: enabled && isStudent, select: parseSuggestions } },
	);
}
