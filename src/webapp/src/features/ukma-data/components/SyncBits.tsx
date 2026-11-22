import { cn } from "@/lib/utils";
import { CHIP_LABELS } from "../syncGroups";
import type { Chip } from "../syncGroups";
import { DataChip } from "./DataBits";
import type { ChipTone } from "./DataBits";

const CHIP_TONES = {
	safe: "success",
	appears: "primary",
	changes: "primary",
	manual: "primary",
	ratings: "caution",
} satisfies Record<Chip, ChipTone>;

export function SyncChip({ chip }: Readonly<{ chip: Chip }>) {
	return <DataChip tone={CHIP_TONES[chip]}>{CHIP_LABELS[chip]}</DataChip>;
}

export function SyncToggle({
	label,
	options,
	value,
	onChange,
}: Readonly<{
	label: string;
	options: readonly [string, string];
	value: 0 | 1;
	onChange: (value: 0 | 1) => void;
}>) {
	return (
		<div
			role="radiogroup"
			aria-label={label}
			className="inline-flex shrink-0 flex-col overflow-hidden rounded-md border text-sm sm:flex-row"
		>
			{options.map((option, index) => (
				<button
					key={option}
					type="button"
					role="radio"
					aria-checked={value === index}
					onClick={() => onChange(index === 0 ? 0 : 1)}
					className={cn(
						"px-3 py-1 transition-colors",
						index === 1 && "border-l",
						value === index
							? "bg-muted font-medium text-foreground"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{option}
				</button>
			))}
		</div>
	);
}
