import * as React from "react";

import { CheckIcon, ChevronDownIcon, Loader2Icon, XIcon } from "lucide-react";

import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/Command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/Popover";
import type { Instructor } from "@/lib/api/generated";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { cn } from "@/lib/utils";
import { useInfiniteInstructors } from "../hooks/useInfiniteInstructors";

function formatInstructorLabel(instructor: Instructor): string {
	const parts = [instructor.last_name ?? "", instructor.first_name ?? ""];
	if (instructor.patronymic) {
		parts.push(instructor.patronymic);
	}
	return parts.filter(Boolean).join(" ");
}

const SEARCH_DEBOUNCE_MS = 200;

interface InstructorMultiSelectProps {
	readonly value: readonly string[];
	readonly onChange: (next: string[]) => void;
	readonly initialOptions?: readonly Instructor[];
	readonly courseOfferingId?: string;
	readonly courseId?: string;
	readonly specialityId?: string;
	readonly placeholder?: string;
	readonly searchPlaceholder?: string;
	readonly emptyText?: string;
	readonly disabled?: boolean;
	readonly maxSelected?: number;
	readonly className?: string;
	readonly "data-testid"?: string;
}

function InstructorMultiSelect({
	value,
	onChange,
	initialOptions = [],
	courseOfferingId,
	courseId,
	specialityId,
	placeholder = "Обрати викладача…",
	searchPlaceholder = "Пошук викладача…",
	emptyText = "Викладачів не знайдено.",
	disabled = false,
	maxSelected,
	className,
	"data-testid": testId,
}: InstructorMultiSelectProps) {
	const [open, setOpen] = React.useState(false);
	const [searchTerm, setSearchTerm] = React.useState("");
	const [debouncedSearch, setDebouncedSearch] = React.useState("");

	React.useEffect(() => {
		const handle = setTimeout(
			() => setDebouncedSearch(searchTerm.trim()),
			SEARCH_DEBOUNCE_MS,
		);
		return () => clearTimeout(handle);
	}, [searchTerm]);

	React.useEffect(() => {
		if (!open) {
			return;
		}
		const unlock = lockBodyScroll();
		return () => unlock();
	}, [open]);

	const { allInstructors, hasMore, isFetchingNextPage, isLoading, loaderRef } =
		useInfiniteInstructors({
			search: debouncedSearch || undefined,
			courseOfferingId,
			courseId,
			specialityId,
			enabled: open,
		});

	const optionsById = React.useMemo(() => {
		const map = new Map<string, Instructor>();
		for (const option of initialOptions) {
			if (option.id) map.set(option.id, option);
		}
		for (const option of allInstructors) {
			if (option.id) map.set(option.id, option);
		}
		return map;
	}, [initialOptions, allInstructors]);

	const selectedSet = React.useMemo(() => new Set(value), [value]);

	const toggleValue = (id: string) => {
		if (selectedSet.has(id)) {
			onChange(value.filter((v) => v !== id));
			return;
		}
		if (maxSelected !== undefined && value.length >= maxSelected) {
			return;
		}
		onChange([...value, id]);
	};

	const removeValue = (event: React.MouseEvent, id: string) => {
		event.preventDefault();
		event.stopPropagation();
		onChange(value.filter((v) => v !== id));
	};

	const selectedInstructors = value
		.map((id) => optionsById.get(id))
		.filter(
			(instr): instr is Instructor & { id: string } =>
				instr !== undefined && Boolean(instr.id),
		);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border bg-transparent px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
						className,
					)}
					disabled={disabled}
					data-testid={testId}
				>
					{selectedInstructors.length === 0 ? (
						<span className="text-muted-foreground truncate">
							{placeholder}
						</span>
					) : (
						selectedInstructors.map((instr) => (
							<span
								key={instr.id}
								className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs"
							>
								<span className="break-words">
									{formatInstructorLabel(instr)}
								</span>
								<button
									type="button"
									aria-label={`Видалити ${formatInstructorLabel(instr)}`}
									className="hover:text-destructive cursor-pointer"
									onClick={(e) => removeValue(e, instr.id)}
								>
									<XIcon className="size-3" />
								</button>
							</span>
						))
					)}
					<ChevronDownIcon className="ml-auto size-4 opacity-50" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				className="w-(--radix-popover-trigger-width) p-0"
				data-testid={testId ? `${testId}-content` : undefined}
			>
				<Command shouldFilter={false}>
					<CommandInput
						value={searchTerm}
						onValueChange={setSearchTerm}
						placeholder={searchPlaceholder}
					/>
					<CommandList
						className="max-h-72 overflow-y-auto"
						data-testid={testId ? `${testId}-list` : undefined}
					>
						{!isLoading && allInstructors.length === 0 ? (
							<CommandEmpty>{emptyText}</CommandEmpty>
						) : null}
						{allInstructors.map((instr) => {
							if (!instr.id) return null;
							const id = instr.id;
							const isSelected = selectedSet.has(id);
							return (
								<CommandItem
									key={id}
									value={id}
									onSelect={() => toggleValue(id)}
									className="flex items-start gap-2"
								>
									<span className="break-words">
										{formatInstructorLabel(instr)}
									</span>
									<CheckIcon
										className={cn(
											"ml-auto size-4 shrink-0",
											isSelected ? "opacity-100" : "opacity-0",
										)}
									/>
								</CommandItem>
							);
						})}
						{(isLoading || isFetchingNextPage) && (
							<div className="text-muted-foreground flex items-center justify-center gap-2 py-2 text-xs">
								<Loader2Icon className="size-3 animate-spin" />
								Завантаження…
							</div>
						)}
						{hasMore ? <div ref={loaderRef} className="h-2" /> : null}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

export { InstructorMultiSelect, formatInstructorLabel };
export type { InstructorMultiSelectProps };
