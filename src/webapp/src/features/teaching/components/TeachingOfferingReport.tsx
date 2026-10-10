import { EyeOff } from "lucide-react";

import { TermBadge } from "@/components/TermBadge";
import { Card, CardContent } from "@/components/ui/Card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/Select";
import { CourseStatsHero } from "@/features/courses/components/CourseStatsCards";
import { getSemesterDisplay } from "@/features/courses/courseFormatting";
import { MIN_RATED_TO_SHOW, type TeachingCourse } from "../types";
import { OfferingHistory } from "./OfferingHistory";
import { ParticipationCard } from "./ParticipationCard";
import { ScoreDistribution } from "./ScoreDistribution";
import { TeachingComments } from "./TeachingComments";

function TooFewRatings({ rated }: Readonly<{ rated: number }>) {
	return (
		<Card className="shadow-sm">
			<CardContent className="flex items-center gap-3 p-4 sm:p-5">
				<EyeOff className="size-5 shrink-0 text-muted-foreground" />
				<p className="text-sm text-muted-foreground">
					Покажемо оцінки, коли оцінять {MIN_RATED_TO_SHOW} студентів. Зараз{" "}
					{rated}.
				</p>
			</CardContent>
		</Card>
	);
}

export function TeachingOfferingReport({
	course,
	offeringId,
	onOfferingChange,
}: Readonly<{
	course: TeachingCourse;
	offeringId: string;
	onOfferingChange: (id: string) => void;
}>) {
	const offering =
		course.offerings.find((item) => item.id === offeringId) ??
		course.offerings[0];
	if (!offering) return null;
	const hidden = offering.rated < MIN_RATED_TO_SHOW;

	return (
		<div className="min-w-0 space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				{/* Phones already show the title in the course select above. */}
				<div className="min-w-0 space-y-2 max-lg:contents">
					<h2 className="sr-only text-2xl font-semibold tracking-tight lg:not-sr-only">
						{course.title}
					</h2>
					{course.offerings.length > 1 ? null : (
						<TermBadge term={offering.term} className="tabular-nums">
							{getSemesterDisplay(offering.year, offering.term)}
						</TermBadge>
					)}
				</div>
				{course.offerings.length > 1 ? (
					<Select value={offering.id} onValueChange={onOfferingChange}>
						<SelectTrigger
							className="w-full sm:w-44"
							aria-label="Семестр"
							data-testid="teaching-offering-select"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{course.offerings.map((item) => (
								<SelectItem key={item.id} value={item.id}>
									{getSemesterDisplay(item.year, item.term)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}
			</div>

			<ParticipationCard
				rated={offering.rated}
				enrolled={offering.enrolled}
				commented={hidden ? null : offering.comments.length}
			/>

			{hidden ? (
				<TooFewRatings rated={offering.rated} />
			) : (
				<>
					<CourseStatsHero
						difficulty={offering.avg_difficulty}
						usefulness={offering.avg_usefulness}
						ratingsCount={offering.rated}
					/>
					<ScoreDistribution
						difficulty={offering.difficulty_counts}
						usefulness={offering.usefulness_counts}
					/>
				</>
			)}

			{course.offerings.length > 1 ? (
				<section className="space-y-3">
					<h3 className="text-lg font-semibold tracking-tight">
						За семестрами
					</h3>
					<OfferingHistory
						offerings={course.offerings}
						selectedId={offering.id}
						onSelect={onOfferingChange}
					/>
				</section>
			) : null}

			{hidden ? null : <TeachingComments comments={offering.comments} />}
		</div>
	);
}
