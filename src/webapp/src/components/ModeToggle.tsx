import { Check, Moon, Sun } from "lucide-react";

import { themeOptions } from "@/components/Header/navigationData";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { testIds } from "@/lib/test-ids";

export function ModeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Обрати тему"
					data-testid={testIds.header.themeToggle}
				>
					<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
					<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
					<span className="sr-only">Обрати тему</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{themeOptions.map((option) => {
					const Icon = option.icon;
					const isActive = theme === option.value;
					return (
						<DropdownMenuItem
							key={option.value}
							onSelect={() => setTheme(option.value)}
							className="pr-8"
							data-testid={`${testIds.header.themeToggle}-option-${option.value}`}
						>
							<Icon className="size-4" />
							{option.label}
							{isActive && <Check className="absolute right-2 size-4" />}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
