import type { ReactNode } from "react";

import { Monitor, Moon, Sun } from "lucide-react";

import type { FeatureFlagName } from "@/lib/feature-flags";

export type NavigationItem = {
	label: string;
	href: string;
	/** Shown only while this flag is on. */
	flag?: FeatureFlagName;
};

export type ThemeOption = "light" | "dark" | "system";

export const navigationItems: NavigationItem[] = [
	{ label: "Курси", href: "/" },
	{ label: "Мої оцінки", href: "/my-ratings" },
	{ label: "Викладачу", href: "/teaching", flag: "fe_teacher_reports" },
];

export const themeOptions: {
	value: ThemeOption;
	label: string;
	icon: (props: { className?: string }) => ReactNode;
}[] = [
	{ value: "light", label: "Світла", icon: (props) => <Sun {...props} /> },
	{ value: "dark", label: "Темна", icon: (props) => <Moon {...props} /> },
	{
		value: "system",
		label: "Система",
		icon: (props) => <Monitor {...props} />,
	},
];
