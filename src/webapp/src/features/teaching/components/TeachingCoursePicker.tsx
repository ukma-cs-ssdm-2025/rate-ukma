import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { cn } from "@/lib/utils";
import type { TeachingCourse } from "../types";

interface TeachingCoursePickerProps {
	readonly courses: readonly TeachingCourse[];
	readonly selectedId: string;
	readonly onSelect: (id: string) => void;
}

function latestRated(course: TeachingCourse) {
	return course.offerings[0]?.rated ?? 0;
}

/** A side list on desktop, a select on phones where the list would push the report down. */
export function TeachingCoursePicker({
	courses,
	selectedId,
	onSelect,
}: TeachingCoursePickerProps) {
	return (
		<>
			<div className="lg:hidden">
				<Select value={selectedId} onValueChange={onSelect}>
					<SelectTrigger
						className="w-full"
						aria-label="Дисципліна"
						data-testid="teaching-course-select"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{courses.map((course) => (
							<SelectItem key={course.id} value={course.id}>
								{course.title}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<nav aria-label="Дисципліни" className="hidden lg:block">
				<ul className="space-y-1">
					{courses.map((course) => {
						const isSelected = course.id === selectedId;
						return (
							<li key={course.id}>
								<button
									type="button"
									aria-current={isSelected ? "page" : undefined}
									onClick={() => onSelect(course.id)}
									className={cn(
										"w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted",
										isSelected && "bg-card-user hover:bg-card-user",
									)}
								>
									<span
										className={cn(
											"line-clamp-2 text-sm font-medium",
											isSelected && "text-primary",
										)}
									>
										{course.title}
									</span>
									<span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
										{latestRated(course)} оцінок за останній семестр
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			</nav>
		</>
	);
}
