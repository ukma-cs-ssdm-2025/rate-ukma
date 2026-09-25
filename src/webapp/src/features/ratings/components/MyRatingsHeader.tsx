import { PageHeader } from "@/components/PageHeader";
import { testIds } from "@/lib/test-ids";

export interface SemesterProgress {
	readonly key: string;
	readonly label: string;
	readonly rated: number;
	readonly total: number;
}

interface MyRatingsHeaderProps {
	totalCourses: number;
	ratedCourses: number;
	/** Oldest first; one segment each, as wide as its share of courses. */
	semesters?: readonly SemesterProgress[];
}

export function MyRatingsHeader({
	totalCourses,
	ratedCourses,
	semesters = [],
}: Readonly<MyRatingsHeaderProps>) {
	return (
		<div data-testid={testIds.myRatings.header}>
			<PageHeader
				title="Мої оцінки"
				description={
					totalCourses > 0 ? (
						<>
							<span className="tabular-nums">
								Оцінено {ratedCourses} з {totalCourses}
							</span>
							{/* Segments follow the semesters below, so the bar stays readable
							    for four years of courses where one segment per course would not. */}
							<span
								className="mt-3 flex h-1.5 w-xl max-w-full gap-1"
								aria-hidden="true"
							>
								{semesters
									.filter((semester) => semester.total > 0)
									.map((semester) => (
										<span
											key={semester.key}
											title={`${semester.label}: ${semester.rated} з ${semester.total}`}
											className="h-full min-w-2 basis-0 overflow-hidden rounded-full bg-muted"
											style={{ flexGrow: semester.total }}
										>
											<span
												className="block h-full bg-primary"
												style={{
													width: `${(semester.rated / semester.total) * 100}%`,
												}}
											/>
										</span>
									))}
							</span>
						</>
					) : undefined
				}
			/>
		</div>
	);
}
