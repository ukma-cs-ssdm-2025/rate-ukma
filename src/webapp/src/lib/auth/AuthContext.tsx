import type { PropsWithChildren } from "react";
import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { env } from "@/env";
import {
	useAuthLoginCreate,
	useAuthLogoutCreate,
	useAuthSessionRetrieve,
} from "../api/generated";
import { setSessionExpiryListener } from "./sessionExpiry";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthUser {
	id: number;
	email?: string;
	firstName?: string;
	lastName?: string;
	patronymic?: string;
}

export interface AuthState {
	status: AuthStatus;
	user: AuthUser | null;
	sessionExpired: boolean;
}

export interface AuthContextValue extends AuthState {
	loginWithMicrosoft: (redirect?: string) => void;
	loginWithDjango: (username: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	checkAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [sessionExpired, setSessionExpired] = useState(false);

	// Lazy auth query - only run when explicitly requested
	const sessionQuery = useAuthSessionRetrieve({
		query: {
			enabled: hasCheckedAuth && !isLoggingOut,
			refetchOnWindowFocus: false,
			refetchInterval: false,
			refetchOnReconnect: false,
			// Don't retry on 401 errors - they're intentional
			retry: (failureCount, error) => {
				const errorStatus =
					(error as { response?: { status?: number }; status?: number })
						?.response?.status ||
					(error as { response?: { status?: number }; status?: number })
						?.status;
				return errorStatus !== 401 && failureCount < 1;
			},
			staleTime: 5 * 60 * 1000,
			gcTime: 10 * 60 * 1000,
		},
	});

	const logoutMutation = useAuthLogoutCreate();
	const loginMutation = useAuthLoginCreate({
		mutation: {
			onSuccess: async () => {
				if (!hasCheckedAuth) {
					setHasCheckedAuth(true);
				}
				await queryClient.invalidateQueries({
					queryKey: sessionQuery.queryKey,
				});
				await queryClient.refetchQueries({ queryKey: sessionQuery.queryKey });
			},
		},
	});

	const authState = useMemo((): AuthState => {
		if (!hasCheckedAuth) {
			return { status: "loading", user: null, sessionExpired: false };
		}

		if (sessionQuery.isLoading || sessionQuery.isFetching) {
			return { status: "loading", user: null, sessionExpired: false };
		}

		if (sessionQuery.error) {
			return { status: "unauthenticated", user: null, sessionExpired };
		}

		if (!sessionQuery.data?.is_authenticated) {
			return { status: "unauthenticated", user: null, sessionExpired };
		}

		const userData = sessionQuery.data?.user;
		return {
			status: "authenticated",
			user: userData
				? {
						id: userData.id,
						email: userData.email,
						firstName: userData.first_name,
						lastName: userData.last_name,
						patronymic: userData.patronymic,
					}
				: null,
			sessionExpired: false,
		};
	}, [
		hasCheckedAuth,
		sessionQuery.isLoading,
		sessionQuery.isFetching,
		sessionQuery.error,
		sessionQuery.data,
		sessionExpired,
	]);

	const loginWithMicrosoft = useCallback((redirect?: string) => {
		const loginUrl = new URL(
			`${env.VITE_API_BASE_URL}/api/v1/auth/login/microsoft/`,
		);
		if (redirect) {
			loginUrl.searchParams.set("redirect", redirect);
		}
		globalThis.location.replace(loginUrl.toString());
	}, []);

	const loginWithDjango = useCallback(
		async (username: string, password: string) => {
			await loginMutation.mutateAsync({ data: { username, password } });
			setSessionExpired(false);
		},
		[loginMutation],
	);

	const logout = useCallback(async () => {
		// Prevent any further auth checks during logout
		setIsLoggingOut(true);
		queryClient.removeQueries({ queryKey: sessionQuery.queryKey });

		navigate({ to: "/login" });
		try {
			await logoutMutation.mutateAsync();
		} catch (error) {
			console.error("Logout failed:", error);
		} finally {
			setHasCheckedAuth(false);
			setIsLoggingOut(false);
			setSessionExpired(false);
		}
	}, [logoutMutation, navigate, queryClient, sessionQuery.queryKey]);

	const checkAuth = useCallback(() => {
		if (!hasCheckedAuth && !isLoggingOut) {
			setHasCheckedAuth(true);
		}
	}, [hasCheckedAuth, isLoggingOut]);

	// Listen for session expiration events from apiClient
	useEffect(() => {
		const handleSessionExpired = () => {
			setSessionExpired(true);
			// Invalidate the session query to trigger re-evaluation of auth state
			queryClient.setQueryData(sessionQuery.queryKey, undefined);
			queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
		};

		setSessionExpiryListener(handleSessionExpired);

		return () => {
			setSessionExpiryListener(null);
		};
	}, [queryClient, sessionQuery.queryKey]);

	const value = useMemo(
		() => ({
			...authState,
			loginWithMicrosoft,
			loginWithDjango,
			logout,
			checkAuth,
		}),
		[authState, loginWithMicrosoft, loginWithDjango, logout, checkAuth],
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
