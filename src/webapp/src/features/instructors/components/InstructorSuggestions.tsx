import { UserRound } from "lucide-react";

import type { InstructorSuggestion } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { cn } from "@/lib/utils";
import { formatInstructorName } from "../formatInstructorName";

const UK_PLURAL = new Intl.PluralRules("uk");
const COURSE_FORMS: Record<Intl.LDMLPluralRule, string> = {
	zero: "курсів",
	one: "курс",
	two: "курси",
	few: "курси",
	many: "курсів",
	other: "курсу",
};

function coursesLabel(count: number): string {
	return `${count} ${COURSE_FORMS[UK_PLURAL.select(count)]}`;
}

export function instructorSuggestionOptionId(listId: string, index: number) {
	return `${listId}-option-${index}`;
}

interface InstructorSuggestionsProps {
	readonly id: string;
	readonly items: ReadonlyArray<InstructorSuggestion>;
	readonly activeIndex: number;
	readonly onPick: (instructor: InstructorSuggestion) => void;
	readonly onHover: (index: number) => void;
	readonly className?: string;
}

/** "Maybe you meant" teachers under the course search: picking one swaps the
 * name query for the instructor filter. */
export function InstructorSuggestions({
	id,
	items,
	activeIndex,
	onPick,
	onHover,
	className,
}: InstructorSuggestionsProps) {
	return (
		<div
			className={cn(
				"bg-popover text-popover-foreground overflow-hidden rounded-md border py-1 shadow-md",
				className,
			)}
			data-testid={testIds.courses.instructorSuggestions}
		>
			<p
				id={`${id}-label`}
				className="text-muted-foreground px-3 pt-1.5 pb-1 text-xs"
			>
				Можливо, ви шукали викладача
			</p>
			<ul id={id} role="listbox" aria-labelledby={`${id}-label`}>
				{items.map((instructor, index) => (
					<li
						key={instructor.id}
						id={instructorSuggestionOptionId(id, index)}
						role="option"
						aria-selected={index === activeIndex}
						// Keep focus in the search box so the list does not close
						// before the click lands.
						onMouseDown={(event) => event.preventDefault()}
						onMouseEnter={() => onHover(index)}
						onClick={() => onPick(instructor)}
						className={cn(
							"flex min-h-10 cursor-pointer items-center gap-3 px-3 py-2 text-sm",
							index === activeIndex && "bg-accent text-accent-foreground",
						)}
					>
						<UserRound
							className="text-muted-foreground size-4 shrink-0"
							aria-hidden="true"
						/>
						<span className="min-w-0 flex-1 truncate">
							{formatInstructorName(instructor)}
						</span>
						<span className="text-muted-foreground shrink-0 text-xs tabular-nums">
							{coursesLabel(instructor.courses_count)}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
