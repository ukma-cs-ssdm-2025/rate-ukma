"use client";

import { useEffect, useState } from "react";

import { Loader2 } from "lucide-react";
import { PiMicrosoftOutlookLogoFill } from "react-icons/pi";

import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";

type MicrosoftLoginButtonProps = {
	className?: string;
	redirectTo?: string;
};

export function MicrosoftLoginButton({
	className,
	redirectTo,
}: MicrosoftLoginButtonProps) {
	const { loginWithMicrosoft, status } = useAuth();
	const [isRedirecting, setIsRedirecting] = useState(false);

	useEffect(() => {
		if (status !== "loading") {
			setIsRedirecting(false);
		}
	}, [status]);

	const handleLoginClick = () => {
		setIsRedirecting(true);
		loginWithMicrosoft(redirectTo);
	};

	const isLoading = status === "loading" || isRedirecting;

	return (
		<Button
			className={className}
			size="lg"
			onClick={handleLoginClick}
			disabled={isLoading}
		>
			{isLoading ? (
				<Loader2 className="h-6 w-6 animate-spin" />
			) : (
				<PiMicrosoftOutlookLogoFill size={24} />
			)}
			<span>Увійти</span>
		</Button>
	);
}
