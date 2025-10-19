import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import {
	createFileRoute,
	useNavigate,
	useSearch,
} from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PiMicrosoftOutlookLogoFill } from "react-icons/pi";

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
		description: "Авторизуйся і побачь рейтинг босів!",
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
		description: "Авторизуйся і побачь, хто на вершині педагогічного Олімпу!",
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
	const { loginWithMicrosoft, status } = useAuth();
	const navigate = useNavigate();
	const search = useSearch({ from: "/login/" });
	const hasRedirected = useRef(false);
	const [isButtonLoading, setIsButtonLoading] = useState(false);

	const message = useMemo(() => {
		const index = Math.floor(Math.random() * REDIRECT_MESSAGES.length);
		return REDIRECT_MESSAGES[index];
	}, []);

	useEffect(() => {
		// Only redirect once and prevent infinite loops
		if (status === "authenticated" && !hasRedirected.current) {
			hasRedirected.current = true;
			const redirectTo = search.redirect || "/";

			// Use router navigation instead of window.location.replace
			navigate({ to: redirectTo, replace: true });
		}
	}, [status, search.redirect, navigate]);

	return (
		<>
			<h1 className="text-3xl font-bold mb-4">Вхід</h1>

			<div className="space-y-3 mb-6">
				<h2 className="text-xl font-semibold">{message.title}</h2>
				<p className="text-base text-muted-foreground">{message.description}</p>
			</div>

			<Button
				className="w-full gap-2 h-12 text-base font-medium bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-200"
				size="lg"
				onClick={() => {
					setIsButtonLoading(true);
					loginWithMicrosoft();
				}}
				disabled={status === "loading" || isButtonLoading}
			>
				{status === "loading" || isButtonLoading ? (
					<Loader2 className="h-6 w-6 animate-spin" />
				) : (
					<PiMicrosoftOutlookLogoFill size={24} />
				)}
				<span>Увійти</span>
			</Button>
		</>
	);
}
