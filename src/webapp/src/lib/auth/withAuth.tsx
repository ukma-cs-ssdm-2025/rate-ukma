import { useEffect, useRef } from "react";

import { useNavigate } from "@tanstack/react-router";

import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toaster";
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
		const hasShownToast = useRef(false);

		useEffect(() => {
			checkAuth();
		}, [checkAuth]);

		useEffect(() => {
			// Redirect to login if unauthenticated
			if (status === "unauthenticated") {
				if (!hasShownToast.current) {
					hasShownToast.current = true;
					toast.error("Час сесії закінчився, перезайдіть, будь ласка");
				}

				navigate({
					to: redirectTo,
					search: {
						redirect: globalThis.location.pathname + globalThis.location.search,
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
