import { Link, useRouterState } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { cn } from "@/lib/utils";
import { STAFF_ONLY } from "../ukmaDataErrors";
import { Term } from "./Term";

const TABS = [
	{ to: "/data", label: "Огляд" },
	{ to: "/data/cases", label: "Справи" },
	{ to: "/data/sync", label: "Журнал і правила" },
] as const;

type TabPath = (typeof TABS)[number]["to"];

export function activeTab(pathname: string): TabPath {
	if (pathname.startsWith("/data/cases")) {
		return "/data/cases";
	}
	if (
		pathname.startsWith("/data/sync") &&
		!pathname.startsWith("/data/sync/preview")
	) {
		return "/data/sync";
	}
	return "/data";
}

export function DataSectionHeader() {
	const active = activeTab(
		useRouterState({ select: (state) => state.location.pathname }),
	);
	return (
		<div className="space-y-4">
			<PageHeader title="Дані САЗ" />
			<p className="text-sm text-muted-foreground">
				Рішення можна ухвалювати тут або в <Term name="console" />.
			</p>
			<nav aria-label="Розділи даних САЗ" className="flex gap-1 border-b">
				{TABS.map((tab) => (
					<Link
						key={tab.to}
						to={tab.to}
						activeOptions={{ exact: true }}
						aria-current={tab.to === active ? "page" : undefined}
						className={cn(
							buttonVariants({ variant: "ghost", size: "sm" }),
							"-mb-px rounded-b-none border-b-2 border-transparent",
							tab.to === active && "border-primary text-primary",
						)}
					>
						{tab.label}
					</Link>
				))}
			</nav>
		</div>
	);
}

export function StaffOnlyState() {
	return (
		<ErrorState
			icon={ShieldAlert}
			title={STAFF_ONLY.title}
			description={STAFF_ONLY.description}
		/>
	);
}
