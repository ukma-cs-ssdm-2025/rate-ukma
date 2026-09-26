import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";

import { testIds } from "@/lib/test-ids";

const logoConfig = {
	container: "size-7 md:h-9 md:w-9",
	icon: "size-4 md:size-5",
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
					aria-hidden="true"
				/>
			</div>
			<span className={logoConfig.text}>
				Rate <span className="text-primary">UKMA</span>
			</span>
		</Link>
	);
}
