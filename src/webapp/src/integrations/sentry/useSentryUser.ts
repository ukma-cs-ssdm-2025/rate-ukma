import { useEffect } from "react";

import * as Sentry from "@sentry/react";

import type { AuthUser } from "@/lib/auth";

export function useSentryUser(user: AuthUser | null) {
	useEffect(() => {
		if (user?.email) {
			Sentry.setUser({
				id: user.id.toString(),
				email: user.email,
				username:
					`${user.firstName || ""} ${user.lastName || ""}`.trim() || undefined,
			});
			Sentry.setTag("user.authenticated", true);
			Sentry.setContext("user_details", {
				firstName: user.firstName,
				lastName: user.lastName,
				patronymic: user.patronymic,
			});
		} else {
			Sentry.setUser(null);
			Sentry.setTag("user.authenticated", false);
			Sentry.setContext("user_details", null);
		}
	}, [user]);
}
