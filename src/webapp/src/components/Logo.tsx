import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

interface RateUKMALogoProps {
	size?: "sm" | "md" | "lg";
	showText?: boolean;
	textClassName?: string;
	className?: string;
	asLink?: boolean;
}

const sizeConfig = {
	sm: {
		container: "h-6 w-6",
		icon: "h-3 w-3",
		text: "text-sm font-semibold",
	},
	md: {
		container: "h-9 w-9",
		icon: "h-5 w-5",
		text: "text-lg font-bold",
	},
	lg: {
		container: "h-16 w-16",
		icon: "h-8 w-8",
		text: "text-5xl font-bold",
	},
};

export function Logo({
	size = "md",
	showText = true,
	textClassName = "",
	className = "",
	asLink = true,
}: Readonly<RateUKMALogoProps>) {
	const config = sizeConfig[size];
	const logoContent = (
		<div
			className={`flex items-center ${showText ? "space-x-3" : ""} ${className}`}
		>
			<div
				className={`${config.container} rounded-lg bg-primary flex items-center justify-center shadow-sm`}
			>
				<Star
					className={`${config.icon} text-primary-foreground`}
					fill="currentColor"
					aria-label="Зірочка рейтингу"
				/>
			</div>
			{showText && (
				<span className={`${config.text} tracking-tight ${textClassName}`}>
					Rate <span className="text-primary">UKMA</span>
				</span>
			)}
		</div>
	);

	if (asLink) {
		return <Link to="/">{logoContent}</Link>;
	}

	return logoContent;
}
