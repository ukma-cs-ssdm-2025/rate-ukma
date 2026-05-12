import { useEffect, useMemo, useRef, useState } from "react";

import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";

import { LoginForm } from "@/components/login/LoginForm";
import { MicrosoftLoginButton } from "@/components/login/MicrosoftLoginButton";
import { useAuth } from "@/lib/auth";

const REDIRECT_MESSAGES = [
	{
		title: "Лише обрані студенти НаУКМА можуть пройти далі 🏰",
		description: "Авторизуйся, герой рейтингових баталій!",
	},
	{
		title: 'Втомився слухати, що "цей курс топ"?',
		description: "Зайди, прочитай відгуки — і виріши сам.",
	},
	{
		title: "Таємний клуб могилянської спільноти 🎯",
		description: "Увійди, щоб дізнатися, які курси справді варті твоєї уваги!",
	},
	{
		title: "Найкращі професори vs найцікавіші курси ⚔️",
		description: "Авторизуйся і побач рейтинг босів!",
	},
	{
		title: "Хто сьогодні отримає 5 зірок? 🌟",
		description: "Зайди, щоб проголосувати за улюблених викладачів!",
	},
	{
		title: "Могилянський рейтинг: легенди та міфи 📚",
		description: "Увійди і дізнайся, де правда, а де — гарна реклама!",
	},
	{
		title: "Не всі герої носять мантії... 🎓",
		description: "Деякі просто залишають чесні відгуки про курси!",
	},
	{
		title: "Битва за рейтинг: Хто переможе? 🏆",
		description: "Авторизуйся і побач, хто на вершині педагогічного Олімпу!",
	},
];

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

	const message = useMemo(() => {
		const index = Math.floor(Math.random() * REDIRECT_MESSAGES.length);
		return REDIRECT_MESSAGES[index];
	}, []);

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
			<h1 className="text-3xl font-bold mb-4">
				{showAdminLogin ? "Admin Panel" : "Вхід"}
			</h1>

			{showAdminLogin ? (
				<LoginForm
					loginWithDjango={loginWithDjango}
					onCancel={() => setShowAdminLogin(false)}
				/>
			) : (
				<>
					<div className="space-y-3 mb-6">
						<h2 className="text-xl font-semibold">{message.title}</h2>
						<p className="text-base text-muted-foreground">
							{message.description}
						</p>
					</div>
					<MicrosoftLoginButton
						className="w-full gap-2 h-12 text-base font-medium bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200"
						redirectTo={search.redirect}
					/>
				</>
			)}
		</>
	);
}
