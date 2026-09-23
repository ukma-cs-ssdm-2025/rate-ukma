import { useEffect, useRef, useState } from "react";

import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";

import { LoginForm } from "@/components/login/LoginForm";
import { MicrosoftLoginButton } from "@/components/login/MicrosoftLoginButton";
import { useAuth } from "@/lib/auth";

type LoginSearch = {
	redirect?: string;
};

export const Route = createFileRoute("/login/")({
	component: LoginPage,
	validateSearch: (search: Record<string, string>): LoginSearch => ({
		redirect: search.redirect,
	}),
});

function LoginPage() {
	const { loginWithDjango, status, checkAuth } = useAuth();
	const navigate = useNavigate();
	const search = useSearch({ from: "/login/" });
	const hasRedirected = useRef(false);
	const [showAdminLogin, setShowAdminLogin] = useState(false);

	useEffect(() => {
		// Check auth status when component mounts
		checkAuth();
	}, [checkAuth]);

	useEffect(() => {
		if (status === "authenticated" && !hasRedirected.current) {
			hasRedirected.current = true;
			const redirectTo = search.redirect || "/";
			navigate({ to: redirectTo, replace: true });
		}
	}, [status, search.redirect, navigate]);

	// Keyboard shortcut for admin login (Ctrl+Shift+D)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.shiftKey && e.key === "D") {
				e.preventDefault();
				setShowAdminLogin((prev) => !prev);
			}
		};
		globalThis.addEventListener("keydown", handleKeyDown);
		return () => globalThis.removeEventListener("keydown", handleKeyDown);
	}, []);

	return (
		<>
			<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
				{showAdminLogin ? "Admin Panel" : "Вхід"}
			</h1>

			{showAdminLogin ? (
				<LoginForm
					loginWithDjango={loginWithDjango}
					onCancel={() => setShowAdminLogin(false)}
				/>
			) : (
				<>
					<MicrosoftLoginButton
						className="w-full"
						redirectTo={search.redirect}
					/>
					<p className="text-sm text-muted-foreground">
						Доступ дозволено тільки для користувачів з корпоративною поштою{" "}
						<span className="font-medium text-foreground">ukma.edu.ua</span>
					</p>
				</>
			)}
		</>
	);
}
