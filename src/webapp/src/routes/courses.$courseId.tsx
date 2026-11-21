import { createFileRoute } from "@tanstack/react-router";

import { CoursePage } from "@/features/course-page/components/CoursePage";
import { withAuth } from "@/lib/auth";

function CourseDetailsRoute() {
	const { courseId } = Route.useParams();
	return <CoursePage courseId={courseId} />;
}

export const Route = createFileRoute("/courses/$courseId")({
	component: withAuth(CourseDetailsRoute),
});
