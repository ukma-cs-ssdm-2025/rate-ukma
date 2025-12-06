import { Link } from "@tanstack/react-router";

import type { NavigationItem } from "./navigationData";
import {
	NavigationMenu,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
} from "../ui/NavigationMenu";

interface HeaderNavProps {
	className?: string;
	items: NavigationItem[];
	"data-testid"?: string;
}

export function HeaderNav({
	className,
	items,
	"data-testid": testId,
}: Readonly<HeaderNavProps>) {
	return (
		<NavigationMenu className={className} data-testid={testId}>
			<NavigationMenuList className="gap-2">
				{items.map((item) => (
					<NavigationMenuItem key={item.href}>
						<NavigationMenuLink
							asChild
							className="group inline-flex h-10 items-center justify-center rounded-lg px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
						>
							<Link to={item.href}>{item.label}</Link>
						</NavigationMenuLink>
					</NavigationMenuItem>
				))}
			</NavigationMenuList>
		</NavigationMenu>
	);
}
