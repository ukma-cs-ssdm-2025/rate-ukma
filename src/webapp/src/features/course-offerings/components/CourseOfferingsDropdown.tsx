import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/Dialog";
import { CourseSpecialityBadges } from "@/features/courses/components/CourseSpecialityBadges";
import { getSemesterTermDisplay } from "@/features/courses/courseFormatting";
import type { CourseOffering } from "@/lib/api/generated";

const BASE_EXTERNAL_URL = "https://my.ukma.edu.ua/course/";

interface CourseOfferingsDropdownProps {
	courseOfferings: CourseOffering[];
}

function groupByYear(
	offerings: CourseOffering[],
): { year: number; offerings: CourseOffering[] }[] {
	const map = new Map<number, CourseOffering[]>();

	for (const offering of offerings) {
		const year = offering.semester_year ?? 0;
		const group = map.get(year) ?? [];
		group.push(offering);
		map.set(year, group);
	}

	return Array.from(map.entries())
		.sort(([a], [b]) => b - a)
		.map(([year, items]) => ({ year, offerings: items }));
}

export function CourseOfferingsDropdown({
	courseOfferings,
}: CourseOfferingsDropdownProps) {
	if (!courseOfferings || courseOfferings.length === 0) return null;

	const groups = groupByYear(courseOfferings);

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<ExternalLink className="h-4 w-4" />
					Курси на САЗ
				</Button>
			</DialogTrigger>

			<DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Курси на САЗ</DialogTitle>
				</DialogHeader>

				<div className="overflow-y-auto flex-1 -mx-6 px-6">
					{groups.map(({ year, offerings }) => (
						<div key={year} className="mb-5 last:mb-0">
							<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
								{year}
							</p>
							<div className="space-y-1">
								{offerings.map((offering) => (
									<a
										key={offering.id}
										href={`${BASE_EXTERNAL_URL}${offering.code}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition-colors"
									>
										<div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
											<span className="font-medium shrink-0">
												{getSemesterTermDisplay(offering.semester_term ?? "")}
											</span>
											{offering.specialities &&
												offering.specialities.length > 0 && (
													<CourseSpecialityBadges
														specialities={offering.specialities}
													/>
												)}
										</div>
										<ExternalLink className="shrink-0 h-4 w-4 text-muted-foreground" />
									</a>
								))}
							</div>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
