import * as React from "react";

import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "@/lib/utils";

type SliderProps = React.ComponentProps<typeof SliderPrimitive.Root> & {
	"data-testid"?: string;
	thumbTestIdPrefix?: string;
};

function Slider({
	className,
	defaultValue,
	value,
	min = 0,
	max = 100,
	"data-testid": rootTestId,
	thumbTestIdPrefix,
	...props
}: SliderProps) {
	const _values = React.useMemo(() => {
		if (Array.isArray(value)) {
			return value;
		}
		if (Array.isArray(defaultValue)) {
			return defaultValue;
		}
		return [min, max];
	}, [value, defaultValue, min, max]);

	const thumbPrefix = thumbTestIdPrefix ?? rootTestId;

	return (
		<SliderPrimitive.Root
			data-slot="slider"
			data-testid={rootTestId}
			defaultValue={defaultValue}
			value={value}
			min={min}
			max={max}
			className={cn(
				"relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
				className,
			)}
			{...props}
		>
			<SliderPrimitive.Track
				data-slot="slider-track"
				className={cn(
					"bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
				)}
			>
				<SliderPrimitive.Range
					data-slot="slider-range"
					className={cn(
						"bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
					)}
				/>
			</SliderPrimitive.Track>
			{Array.from({ length: _values.length }, (_, index) => (
				<SliderPrimitive.Thumb
					data-slot="slider-thumb"
					key={`slider-thumb-${String(index)}`}
					data-testid={
						thumbPrefix ? `${thumbPrefix}-thumb-${String(index)}` : undefined
					}
					className="border-primary ring-ring/50 block size-4 shrink-0 rounded-full border bg-white shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
				/>
			))}
		</SliderPrimitive.Root>
	);
}

export { Slider };
