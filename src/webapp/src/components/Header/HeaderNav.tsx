import type { ReactNode } from "react";

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
	/** Something to show after an item's label, keyed by its href. */
	trailing?: Partial<Record<string, ReactNode>>;
	"data-testid"?: string;
}

export function HeaderNav({
	className,
	items,
	trailing,
	"data-testid": testId,
}: Readonly<HeaderNavProps>) {
	return (
		<NavigationMenu className={className} data-testid={testId}>
			<NavigationMenuList className="gap-2">
				{items.map((item) => (
					<NavigationMenuItem key={item.href}>
						<NavigationMenuLink
							asChild
							className="group inline-flex h-10 flex-row items-center gap-2 justify-center rounded-lg px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
						>
							<Link to={item.href}>
								{item.label}
								{trailing?.[item.href]}
							</Link>
						</NavigationMenuLink>
					</NavigationMenuItem>
				))}
			</NavigationMenuList>
		</NavigationMenu>
	);
}
