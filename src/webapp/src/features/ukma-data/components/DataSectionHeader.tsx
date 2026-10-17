import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { buttonVariants } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { cn } from "@/lib/utils";

const TABS = [
	{ to: "/data", label: "Огляд", exact: true },
	{ to: "/data/cases", label: "Справи", exact: false },
] as const;

export function DataSectionHeader() {
	return (
		<div className="space-y-4">
			<PageHeader
				title="UKMA Data"
				description="Синхронізація з САЗ і справи, які сервіс не вирішив сам"
			/>
			<nav aria-label="Розділи UKMA Data" className="flex gap-1 border-b">
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
			title="Розділ лише для суперкористувачів"
			description="Попросіть адміністратора Rate UKMA, якщо вам потрібен доступ."
		/>
	);
}
