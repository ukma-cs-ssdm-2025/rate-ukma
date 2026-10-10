import { useState, type ReactNode } from "react";

import { Presentation } from "lucide-react";

import Layout from "@/components/Layout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/Empty";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFeatureFlagState } from "@/lib/feature-flags";
import { useTeachingCourses } from "../hooks/useTeachingCourses";
import type { TeachingCourse } from "../types";
import { TeachingCoursePicker } from "./TeachingCoursePicker";
import { TeachingOfferingReport } from "./TeachingOfferingReport";

/**
 * Prototype of what a teacher sees about their own courses: how many students
 * rated, the average scores, how they spread, and the comments. Behind
 * `fe_teacher_reports`; the data comes from mocks until the API exists.
 */
export function TeachingPage() {
	const { enabled, isReady } = useFeatureFlagState("fe_teacher_reports");
	const query = useTeachingCourses({ enabled: isReady && enabled });

	let content: ReactNode;
	if (!isReady || (enabled && query.isLoading)) {
		content = <TeachingSkeleton />;
	} else if (!enabled) {
		content = <TeachingUnavailable />;
	} else if (query.isError) {
		content = (
			<ErrorState
				title="Не вдалося завантажити дисципліни"
				role="alert"
				onRetry={() => query.refetch()}
			/>
		);
	} else if (!query.data?.items.length) {
		content = <TeachingUnavailable />;
	} else {
		content = <TeachingReports courses={query.data.items} />;
	}

	return (
		<Layout>
			<div className="space-y-6 pb-16">
				<PageHeader
					title="Мої дисципліни"
					description="Оцінки студентів анонімні"
				/>
				{content}
			</div>
		</Layout>
	);
}

function TeachingReports({
	courses,
}: Readonly<{ courses: readonly TeachingCourse[] }>) {
	const [courseId, setCourseId] = useState(courses[0].id);
	const course = courses.find((item) => item.id === courseId) ?? courses[0];
	const [offeringId, setOfferingId] = useState(course.offerings[0]?.id ?? "");

	const selectCourse = (id: string) => {
		setCourseId(id);
		const next = courses.find((item) => item.id === id);
		setOfferingId(next?.offerings[0]?.id ?? "");
	};

	return (
		<div className="grid gap-x-10 gap-y-6 lg:grid-cols-[260px_minmax(0,1fr)]">
			<TeachingCoursePicker
				courses={courses}
				selectedId={course.id}
				onSelect={selectCourse}
			/>
			<TeachingOfferingReport
				key={course.id}
				course={course}
				offeringId={offeringId}
				onOfferingChange={setOfferingId}
			/>
		</div>
	);
}

function TeachingUnavailable() {
	return (
		<Empty className="border-0 py-16">
			<EmptyHeader className="max-w-md">
				<EmptyMedia variant="icon">
					<Presentation />
				</EmptyMedia>
				<EmptyTitle>Тут будуть ваші дисципліни</EmptyTitle>
				<EmptyDescription>Сторінка доступна лише викладачам.</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function TeachingSkeleton() {
	return (
		<div
			className="grid gap-x-10 gap-y-6 lg:grid-cols-[260px_minmax(0,1fr)]"
			aria-hidden="true"
		>
			<div className="space-y-2">
				<Skeleton className="h-10 w-full" />
				<Skeleton className="hidden h-10 w-full lg:block" />
			</div>
			<div className="space-y-6">
				<Skeleton className="h-8 w-2/3" />
				<Card className="shadow-sm">
					<CardContent className="space-y-3 p-4 sm:p-5">
						<Skeleton className="h-8 w-40" />
						<Skeleton className="h-2 w-full" />
					</CardContent>
				</Card>
				<Skeleton className="h-40 w-full rounded-xl" />
			</div>
		</div>
	);
}
