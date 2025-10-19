import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { useAuth } from "./useAuth";

interface WithAuthProps {
	redirectTo?: string;
	loadingText?: string;
}

export function withAuth<P extends object>(
	Component: React.ComponentType<P>,
	options: WithAuthProps = {},
) {
	const { redirectTo = "/login", loadingText = "Перевірка авторизації..." } =
		options;

	return function WithAuthComponent(props: P) {
		const { status, checkAuth } = useAuth();
		const navigate = useNavigate();

		useEffect(() => {
			// Only check auth if we're unauthenticated and haven't checked yet
			if (status === "unauthenticated") {
				checkAuth();
			}
		}, [checkAuth, status]);

		useEffect(() => {
			// Redirect to login if unauthenticated
			if (status === "unauthenticated") {
				navigate({
					to: redirectTo,
					search: {
						redirect: window.location.pathname + window.location.search,
					},
					replace: true,
				});
			}
		}, [status, navigate]);

		// Show loading state while checking auth
		if (status === "loading") {
			return (
				<div className="flex min-h-screen flex-col items-center justify-center space-y-6">
					<Spinner className="h-8 w-8" />
					<p className="text-lg font-medium text-muted-foreground">
						{loadingText}
					</p>
				</div>
			);
		}

		// Don't render anything if unauthenticated (redirecting)
		if (status === "unauthenticated") {
			return null;
		}

		// Render component only when authenticated
		return <Component {...props} />;
	};
}
