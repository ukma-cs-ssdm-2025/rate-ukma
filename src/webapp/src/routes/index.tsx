import { createFileRoute } from "@tanstack/react-router";

import Layout from "@/components/Layout";
import { CoursesPage } from "@/features/courses/CoursesPage";
import { withAuth } from "@/lib/auth";

function CoursesRoute() {
	return (
		<Layout>
			<CoursesPage />
		</Layout>
	);
}

export const Route = createFileRoute("/")({
	component: withAuth(CoursesRoute),
});
