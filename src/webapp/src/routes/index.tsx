import { createFileRoute } from "@tanstack/react-router";

import { CoursesPage } from "@/features/courses/components/CoursesPage";
import { withAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
	component: withAuth(CoursesPage),
});
