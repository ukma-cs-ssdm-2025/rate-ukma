import { createFileRoute } from "@tanstack/react-router";

import { MyRatingsPage } from "@/features/ratings/components/MyRatingsPage";
import { withAuth } from "@/lib/auth/withAuth";

export const Route = createFileRoute("/my-ratings")({
	component: withAuth(MyRatingsPage),
});
