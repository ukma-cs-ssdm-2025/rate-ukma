import { useMemo, useState } from "react";

import { Link } from "@tanstack/react-router";

import { SectionHeader } from "@/components/SectionHeader";
import { TermBadge } from "@/components/TermBadge";
import { Button } from "@/components/ui/Button";
import { groupRatingsByYearAndSemester } from "@/features/ratings/groupRatings";
import type { StudentRatingsDetailed } from "@/lib/api/generated";
import { testIds } from "@/lib/test-ids";
import { RateAction } from "./MyRatingCard";
import { RatingModal } from "./RatingModal";

const PENDING_PREVIEW_COUNT = 5;

interface MyRatingsPendingSectionProps {
	items: StudentRatingsDetailed[];
	variant: "preview" | "grouped";
	onRatingChanged: () => undefined | Promise<unknown>;
	onShowAll?: () => void;
}

export function MyRatingsPendingSection({
	items,
	variant,
	onRatingChanged,
	onShowAll,
}: Readonly<MyRatingsPendingSectionProps>) {
	const groups = useMemo(
		() => (variant === "grouped" ? groupRatingsByYearAndSemester(items) : []),
		[items, variant],
	);

	if (items.length === 0) return null;

	if (variant === "grouped") {
		return (
			<div className="space-y-8">
				{groups.map((yearGroup) => (
					<div key={yearGroup.key} className="space-y-3">
						<SectionHeader title={yearGroup.label} />
						<div className="space-y-6">
							{yearGroup.seasons.map((seasonGroup) => (
								<section
									key={seasonGroup.key}
									aria-label={seasonGroup.description}
									className="space-y-1"
								>
									<div
										className="flex flex-wrap items-center gap-2 py-2"
										data-testid={testIds.myRatings.semesterTrigger}
									>
										{seasonGroup.seasonRaw ? (
											<TermBadge term={seasonGroup.seasonRaw}>
												{seasonGroup.label}
											</TermBadge>
										) : (
											<span className="font-medium text-foreground">
												{seasonGroup.label}
											</span>
										)}
									</div>
									<div className="divide-y divide-border/30">
										{[...seasonGroup.items]
											.sort((a, b) =>
												(a.course_title ?? "").localeCompare(
													b.course_title ?? "",
												),
											)
											.map((course, index) => (
												<PendingRow
													key={
														course.course_offering_id ??
														course.course_id ??
														`${seasonGroup.key}-${index}`
													}
													course={course}
													showTerm={false}
													onRatingChanged={onRatingChanged}
												/>
											))}
									</div>
								</section>
							))}
						</div>
					</div>
				))}
			</div>
		);
	}

	const visibleItems = items.slice(0, PENDING_PREVIEW_COUNT);

	return (
		<section aria-label="Чекають на оцінку" className="space-y-1">
			<SectionHeader title="Чекають на оцінку" />
			<div className="divide-y divide-border/30">
				{visibleItems.map((course, index) => (
					<PendingRow
						key={
							course.course_offering_id ??
							course.course_id ??
							`pending-${index}`
						}
						course={course}
						showTerm
						onRatingChanged={onRatingChanged}
					/>
				))}
			</div>
			{items.length > PENDING_PREVIEW_COUNT && onShowAll ? (
				<Button variant="ghost" size="sm" className="-ml-3" onClick={onShowAll}>
					Показати всі ({items.length})
				</Button>
			) : null}
		</section>
	);
}

interface PendingRowProps {
	course: StudentRatingsDetailed;
	showTerm: boolean;
	onRatingChanged: () => undefined | Promise<unknown>;
}

function PendingRow({
	course,
	showTerm,
	onRatingChanged,
}: Readonly<PendingRowProps>) {
	const courseId = course.course_id;
	const offeringId = course.course_offering_id;
	const canRate = Boolean(course.can_rate);
	const [showRatingModal, setShowRatingModal] = useState(false);

	return (
		<div
			className="flex items-center gap-3 py-3"
			data-testid={testIds.myRatings.card}
		>
			<div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
				{courseId ? (
					<Link
						to="/courses/$courseId"
						params={{ courseId }}
						className="truncate font-medium text-foreground underline-offset-4 decoration-dotted hover:underline"
						data-testid={testIds.myRatings.courseTitleLink}
					>
						{course.course_title ?? "Курс"}
					</Link>
				) : (
					<span className="truncate font-medium text-foreground">
						{course.course_title ?? "Курс"}
					</span>
				)}
				{showTerm && course.semester?.season ? (
					<TermBadge term={course.semester.season} />
				) : null}
			</div>
			<RateAction
				courseId={courseId}
				offeringId={offeringId}
				canRate={canRate}
				onRate={() => setShowRatingModal(true)}
				variant="outline"
			/>
			{courseId && offeringId ? (
				<RatingModal
					isOpen={showRatingModal}
					onClose={() => setShowRatingModal(false)}
					courseId={courseId}
					offeringId={offeringId}
					courseName={course.course_title}
					existingRating={null}
					onSuccess={onRatingChanged}
				/>
			) : null}
		</div>
	);
}
