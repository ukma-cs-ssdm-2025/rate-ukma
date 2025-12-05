import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { testIds } from "@/lib/test-ids";

const logoConfig = {
	container: "h-7 w-7 md:h-9 md:w-9",
	icon: "h-4 w-4 md:h-5 md:w-5",
	text: "text-base font-bold md:text-lg",
};

export function Logo() {
	return (
		<Link
			to="/"
			className="flex items-center space-x-3"
			data-testid={testIds.header.logo}
		>
			<div
				className={`${logoConfig.container} rounded-lg bg-primary flex items-center justify-center shadow-sm`}
			>
				<Star
					className={`${logoConfig.icon} text-primary-foreground`}
					fill="currentColor"
					aria-label="Зірочка рейтингу"
				/>
			</div>
			<span className={logoConfig.text}>
				Rate <span className="text-primary">UKMA</span>
			</span>
		</Link>
	);
}
