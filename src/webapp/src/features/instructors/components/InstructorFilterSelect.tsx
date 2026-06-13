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
import { useInstructorsRetrieve } from "@/lib/api/generated";
import { lockBodyScroll } from "@/lib/body-scroll-lock";
import { cn } from "@/lib/utils";
import { useInfiniteInstructors } from "../hooks/useInfiniteInstructors";
import { formatInstructorLabel } from "./InstructorMultiSelect";

const SEARCH_DEBOUNCE_MS = 200;

interface InstructorFilterSelectProps {
	/** Selected instructor id, or "" for none. */
	readonly value: string;
	readonly onChange: (next: string) => void;
	readonly placeholder?: string;
	readonly searchPlaceholder?: string;
	readonly emptyText?: string;
	readonly className?: string;
	readonly "data-testid"?: string;
}

/** Single-select instructor picker for the courses filter: server search +
 * infinite scroll over the full directory (not a truncated top-N list). */
function InstructorFilterSelect({
	value,
	onChange,
	placeholder = "Усі викладачі",
	searchPlaceholder = "Пошук викладача…",
	emptyText = "Викладачів не знайдено.",
	className,
	"data-testid": testId,
}: InstructorFilterSelectProps) {
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

	// Resolve the selected instructor's name — it may not be in the loaded
	// page (e.g. when the id comes from the URL on first load).
	const { data: selected } = useInstructorsRetrieve(value, {
		query: { enabled: Boolean(value) },
	});

	const { allInstructors, hasMore, isFetchingNextPage, isLoading, loaderRef } =
		useInfiniteInstructors({
			search: debouncedSearch || undefined,
			enabled: open,
		});

	const handleSelect = (id: string) => {
		onChange(id);
		setOpen(false);
	};

	const clear = (event: React.MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		onChange("");
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					role="combobox"
					aria-expanded={open}
					className={cn(
						"border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50 flex min-h-9 w-full items-center gap-1 rounded-md border bg-transparent px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]",
						className,
					)}
					data-testid={testId}
				>
					<span className={cn("truncate", !value && "text-muted-foreground")}>
						{value
							? selected
								? formatInstructorLabel(selected)
								: "…"
							: placeholder}
					</span>
					{value ? (
						<button
							type="button"
							aria-label="Очистити викладача"
							className="text-muted-foreground hover:text-destructive ml-auto cursor-pointer"
							onClick={clear}
						>
							<XIcon className="size-4" />
						</button>
					) : (
						<ChevronDownIcon className="ml-auto size-4 opacity-50" />
					)}
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
							return (
								<CommandItem
									key={id}
									value={id}
									onSelect={() => handleSelect(id)}
									className="flex items-start gap-2"
								>
									<span className="break-words">
										{formatInstructorLabel(instr)}
									</span>
									<CheckIcon
										className={cn(
											"ml-auto size-4 shrink-0",
											value === id ? "opacity-100" : "opacity-0",
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

export { InstructorFilterSelect };
export type { InstructorFilterSelectProps };
