import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { cn } from "@/lib/utils";
import { STAFF_ONLY } from "../ukmaDataErrors";

const TABS = [
	{ to: "/data", label: "Огляд", exact: true },
	{ to: "/data/cases", label: "Справи", exact: false },
	{ to: "/data/sync", label: "Оновлення з САЗ", exact: false },
] as const;

export function DataSectionHeader() {
	return (
		<div className="space-y-4">
			<PageHeader title="Дані САЗ" />
			<nav aria-label="Розділи даних САЗ" className="flex gap-1 border-b">
				{TABS.map((tab) => (
					<Link
						key={tab.to}
						to={tab.to}
						activeOptions={{ exact: tab.exact }}
						className={cn(
							buttonVariants({ variant: "ghost", size: "sm" }),
							"-mb-px rounded-b-none border-b-2 border-transparent",
						)}
						activeProps={{ className: "border-primary text-primary" }}
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
