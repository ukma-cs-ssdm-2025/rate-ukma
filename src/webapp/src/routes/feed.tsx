import { createFileRoute } from "@tanstack/react-router";

import { FeedPage } from "@/features/feed/components/FeedPage";
import { withAuth } from "@/lib/auth";

export const Route = createFileRoute("/feed")({
	component: withAuth(FeedPage),
});
