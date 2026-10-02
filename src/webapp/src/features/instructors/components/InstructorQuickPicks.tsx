import { Plus } from "lucide-react";

import type { Instructor } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import {
	formatInstructorName,
	formatInstructorShortName,
} from "../formatInstructorName";

interface InstructorQuickPicksProps {
	readonly instructors: ReadonlyArray<Instructor>;
	readonly onPick: (instructorId: string) => void;
}

/** Teachers other students named on this course, one tap from the picker. */
export function InstructorQuickPicks({
	instructors,
	onPick,
}: InstructorQuickPicksProps) {
	return (
		<div
			className="flex flex-wrap items-center gap-1.5"
			data-testid={testIds.rating.instructorQuickPicks}
		>
			<span className="text-xs text-muted-foreground">Інші обирали:</span>
			{instructors.map(({ id, ...instructor }) => (
				<button
					key={id}
					type="button"
					onClick={() => id && onPick(id)}
					aria-label={`Додати: ${formatInstructorName(instructor)}`}
					title={formatInstructorName(instructor)}
					className="inline-flex min-h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-primary/40 px-2.5 text-xs text-primary transition-colors hover:border-primary hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none"
				>
					<Plus className="size-3" aria-hidden="true" />
					{formatInstructorShortName(instructor)}
				</button>
			))}
		</div>
	);
}
