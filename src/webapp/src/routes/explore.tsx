import { createFileRoute } from "@tanstack/react-router";

import { ExplorePage } from "@/features/courses/components/ExplorePage";
import { withAuth } from "@/lib/auth";

export const Route = createFileRoute("/explore")({
	component: withAuth(ExplorePage),
});
