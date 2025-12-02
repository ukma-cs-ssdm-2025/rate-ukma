import * as React from "react";

import { CheckIcon, ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/Command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/Popover";
import { cn } from "@/lib/utils";

interface ComboboxOption {
	value: string;
	label: string;
}

interface ComboboxProps {
	readonly options: readonly ComboboxOption[];
	readonly value: string;
	readonly onValueChange: (value: string) => void;
	readonly placeholder?: string;
	readonly searchPlaceholder?: string;
	readonly emptyText?: string;
	readonly disabled?: boolean;
	readonly className?: string;
	readonly contentClassName?: string;
}

function Combobox({
	options,
	value,
	onValueChange,
	placeholder = "Обрати...",
	searchPlaceholder = "Пошук...",
	emptyText = "Нічого не знайдено.",
	disabled = false,
	className,
	contentClassName,
}: ComboboxProps) {
	const [open, setOpen] = React.useState(false);

	const selectedOption = React.useMemo(
		() => options.find((option) => option.value === value),
		[options, value],
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"w-full justify-between font-normal",
						!selectedOption && "text-muted-foreground",
						className,
					)}
					disabled={disabled}
				>
					<span className="truncate">
						{selectedOption ? selectedOption.label : placeholder}
					</span>
					<ChevronDownIcon className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent
				className={cn(
					"w-(--radix-popover-trigger-width) p-0",
					contentClassName,
				)}
			>
				<Command>
					<CommandInput placeholder={searchPlaceholder} />
					<CommandList>
						<CommandEmpty>{emptyText}</CommandEmpty>
						<CommandGroup>
							{options.map((option) => (
								<CommandItem
									key={option.value}
									value={option.label}
									onSelect={() => {
										onValueChange(option.value === value ? "" : option.value);
										setOpen(false);
									}}
								>
									<span className="truncate">{option.label}</span>
									<CheckIcon
										className={cn(
											"ml-auto size-4",
											value === option.value ? "opacity-100" : "opacity-0",
										)}
									/>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export { Combobox };
export type { ComboboxOption, ComboboxProps };
