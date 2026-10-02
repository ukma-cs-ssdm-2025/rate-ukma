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
	/** A small mark after an item's label, keyed by its href; kept out of the layout. */
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
							className="group relative inline-flex h-10 flex-row items-center justify-center rounded-lg px-6 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
						>
							<Link to={item.href}>
								{item.label}
								{/* Out of the flow, in the link's own padding: a count that
								    lands after the page must not slide the centred nav. */}
								{trailing?.[item.href] ? (
									<span className="absolute top-1/2 right-1 -translate-y-1/2">
										{trailing[item.href]}
									</span>
								) : null}
							</Link>
						</NavigationMenuLink>
					</NavigationMenuItem>
				))}
			</NavigationMenuList>
		</NavigationMenu>
	);
}
