import { createFileRoute } from "@tanstack/react-router";

import { MyRatingsPage } from "@/features/ratings/components/MyRatingsPage";
import { withAuth } from "@/lib/auth";

export const Route = createFileRoute("/my-ratings")({
	component: withAuth(MyRatingsPage),
});
