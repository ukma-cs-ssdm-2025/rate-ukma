import { useState } from "react";

import { Link } from "@tanstack/react-router";
import { CalendarCheck, CalendarPlus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import type {
	CourseOffering,
	CourseOfferingSpecialityInline,
} from "@/lib/api/generated";
import { useAuth } from "@/lib/auth";
import { useFeatureFlagState } from "@/lib/feature-flags";
import { testIds } from "@/lib/test-ids";
import { usePlannedCourses } from "../hooks/usePlannedCourses";
import { getSemesterTitle } from "../planFormatting";
import { findPlannedCourse } from "../planStore";
import { AddToPlanDialog } from "./AddToPlanDialog";

export interface PlanCandidate {
	courseId: string;
	title: string;
	facultyName: string | null;
	specialities: readonly CourseOfferingSpecialityInline[];
	offerings: readonly CourseOffering[];
}

/** «Додати в ІНП» on a course page; for students while the plan is on. */
export function AddToPlanButton({
	course,
}: Readonly<{ course: PlanCandidate }>) {
	const { enabled, isReady } = useFeatureFlagState("fe_personal_plan");
	const { isStudent, user } = useAuth();
	const { planned } = usePlannedCourses(user?.id);
	const [open, setOpen] = useState(false);

	if (!isReady || !enabled || !isStudent) return null;

	const place = findPlannedCourse(planned, course.courseId);

	return (
		<>
			{place ? (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
					<span className="inline-flex items-center gap-1.5 font-medium text-success">
						<CalendarCheck aria-hidden className="size-4" />У вашому ІНП
					</span>
					<span className="text-muted-foreground">
						{place.target.studyYear} курс ·{" "}
						{getSemesterTitle(place.target.term).toLowerCase()}
						{place.slot === "backup" ? " · запасна" : ""}
					</span>
					<Button
						variant="link"
						size="sm"
						className="h-auto px-0"
						onClick={() => setOpen(true)}
					>
						Змінити
					</Button>
					<Button variant="link" size="sm" className="h-auto px-0" asChild>
						<Link to="/plan">Відкрити ІНП</Link>
					</Button>
				</div>
			) : (
				<Button
					onClick={() => setOpen(true)}
					data-testid={testIds.personalPlan.addToPlanButton}
				>
					<CalendarPlus aria-hidden />
					Додати в ІНП
				</Button>
			)}
			<AddToPlanDialog
				open={open}
				onOpenChange={setOpen}
				course={course}
				place={place}
			/>
		</>
	);
}
