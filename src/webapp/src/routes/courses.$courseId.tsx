import * as React from "react";

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import Layout from "@/components/Layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { Separator } from "@/components/ui/Separator";
import { CourseDetailsHeader } from "@/features/courses/components/CourseDetailsHeader";
import { CourseSpecialities } from "@/features/courses/components/CourseSpecialities";
import { CourseStatsCards } from "@/features/courses/components/CourseStatsCards";
import { CourseRatingsList } from "@/features/ratings/components/CourseRatingsList";
import { useCoursesRetrieve } from "@/lib/api/generated";
import { withAuth } from "@/lib/auth";

function CourseDetailsRoute() {
	const { courseId } = Route.useParams();
	const navigate = useNavigate();
	const { data: course, isLoading, isError } = useCoursesRetrieve(courseId);

	const handleBack = React.useCallback(() => {
		navigate({ to: "/" });
	}, [navigate]);

	if (isLoading) {
		return (
			<Layout>
				<CourseDetailsSkeleton onBack={handleBack} />
			</Layout>
		);
	}

	if (isError || !course) {
		return (
			<Layout>
				<div className="space-y-6">
					<Button variant="outline" onClick={handleBack}>
						<ArrowLeft className="mr-2 h-4 w-4" />
						Назад до курсів
					</Button>
					<Card className="border-destructive">
						<CardContent className="pt-6">
							<p className="text-center text-muted-foreground">
								Не вдалося завантажити інформацію про курс
							</p>
						</CardContent>
					</Card>
				</div>
			</Layout>
		);
	}

	return (
		<Layout>
			<div className="space-y-8">
				<CourseDetailsHeader
					title={course.title}
					status={course.status}
					facultyName={course.faculty_name}
					departmentName={course.department_name}
					onBack={handleBack}
				/>

				<CourseStatsCards
					difficulty={course.avg_difficulty ?? null}
					usefulness={course.avg_usefulness ?? null}
					ratingsCount={course.ratings_count ?? null}
				/>

				<Separator />

				{course.description && (
					<div className="space-y-3">
						<h2 className="text-2xl font-semibold">Опис курсу</h2>
						<p className="text-muted-foreground leading-relaxed">
							{course.description}
						</p>
					</div>
				)}

				{course.specialities_with_kind &&
					course.specialities_with_kind.length > 0 && (
						<CourseSpecialities specialities={course.specialities_with_kind} />
					)}

				<CourseRatingsList courseId={courseId} />
			</div>
		</Layout>
	);
}

function CourseDetailsSkeleton({ onBack }: { onBack: () => void }) {
	return (
		<div className="space-y-8">
			<Button variant="outline" onClick={onBack} size="sm">
				<ArrowLeft className="mr-2 h-4 w-4" />
				Назад до курсів
			</Button>

			<div className="space-y-3">
				<Skeleton className="h-12 w-3/4" />
				<div className="flex items-center gap-3">
					<Skeleton className="h-6 w-24" />
					<Skeleton className="h-6 w-32" />
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				{[...Array(3)].map((_, i) => (
					<Card key={`skeleton-card-${i.toString()}`}>
						<CardContent className="pt-6">
							<Skeleton className="h-16 w-full" />
						</CardContent>
					</Card>
				))}
			</div>

			<Separator />

			<div className="space-y-3">
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-20 w-full" />
			</div>

			<div className="space-y-3">
				<Skeleton className="h-8 w-40" />
				<div className="space-y-3">
					{[...Array(3)].map((_, i) => (
						<Skeleton
							key={`skeleton-card-${i.toString()}`}
							className="h-20 w-full"
						/>
					))}
				</div>
			</div>
		</div>
	);
}

export const Route = createFileRoute("/courses/$courseId")({
	component: withAuth(CourseDetailsRoute),
});
