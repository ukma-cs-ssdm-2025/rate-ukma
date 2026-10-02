import type { InstructorSuggestion } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { formatInstructorName } from "../formatInstructorName";

interface InstructorQuickPicksProps {
	readonly items: ReadonlyArray<InstructorSuggestion>;
	readonly onPick: (instructor: InstructorSuggestion) => void;
}

/** One-tap teachers other students named on this course, styled like the
 * filters' «Обрати мою» speciality link. */
export function InstructorQuickPicks({
	items,
	onPick,
}: InstructorQuickPicksProps) {
	return (
		<p
			className="text-xs text-muted-foreground"
			data-testid={testIds.rating.instructorQuickPicks}
		>
			Обрати:{" "}
			{items.map((instructor, index) => (
				<span key={instructor.id}>
					{index > 0 && ", "}
					<button
						type="button"
						className="text-left text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						onClick={() => onPick(instructor)}
					>
						{formatInstructorName(instructor)}
					</button>
				</span>
			))}
		</p>
	);
}
