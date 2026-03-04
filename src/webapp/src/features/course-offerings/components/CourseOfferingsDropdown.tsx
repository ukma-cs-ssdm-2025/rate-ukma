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

const UNKNOWN_YEAR = "unknown";

function groupByYear(
	offerings: CourseOffering[],
): { year: number | null; label: string; offerings: CourseOffering[] }[] {
	const map = new Map<number | typeof UNKNOWN_YEAR, CourseOffering[]>();

	for (const offering of offerings) {
		const key = offering.semester_year ?? UNKNOWN_YEAR;
		const group = map.get(key) ?? [];
		group.push(offering);
		map.set(key, group);
	}

	return Array.from(map.entries())
		.sort(([a], [b]) => {
			if (a === UNKNOWN_YEAR) return 1;
			if (b === UNKNOWN_YEAR) return -1;
			return (b as number) - (a as number);
		})
		.map(([key, items]) => ({
			year: key === UNKNOWN_YEAR ? null : (key as number),
			label: key === UNKNOWN_YEAR ? "Невідомий рік" : String(key),
			offerings: items,
		}));
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
					{groups.map(({ label, offerings }) => (
						<div key={label} className="mb-5 last:mb-0">
							<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
								{label}
							</p>
							<div className="space-y-1">
								{offerings.map((offering) => (
									<a
										key={offering.id}
										href={`${BASE_EXTERNAL_URL}${encodeURIComponent(offering.code ?? "")}`}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center justify-between gap-4 rounded-md px-3 py-2.5 text-sm hover:bg-accent transition-colors"
									>
										<div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
											<span className="font-medium shrink-0">
												{getSemesterTermDisplay(
													offering.semester_term ?? "",
													"Невідомий семестр",
												)}
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
