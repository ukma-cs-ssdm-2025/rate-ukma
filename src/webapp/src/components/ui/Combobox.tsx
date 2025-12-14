import * as React from "react";

import { CheckIcon, ChevronDownIcon } from "lucide-react";

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
	readonly "data-testid"?: string;
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
	"data-testid": testId,
}: ComboboxProps) {
	const [open, setOpen] = React.useState(false);

	const selectedOption = React.useMemo(
		() => options.find((option) => option.value === value),
		[options, value],
	);

	// Disable page scrolling when combobox is open
	React.useEffect(() => {
		if (open) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
						!selectedOption && "text-muted-foreground",
						className,
					)}
					disabled={disabled}
					data-placeholder={!selectedOption ? "" : undefined}
					data-testid={testId}
				>
					<span className="truncate">
						{selectedOption ? selectedOption.label : placeholder}
					</span>
					<ChevronDownIcon className="size-4 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				className={cn(
					"w-(--radix-popover-trigger-width) p-0 h-fit",
					contentClassName,
				)}
			>
				<Command className="overflow-hidden rounded-md border-0">
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
									<span className="break-words">{option.label}</span>
									<CheckIcon
										className={cn(
											"ml-auto size-4 shrink-0",
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
