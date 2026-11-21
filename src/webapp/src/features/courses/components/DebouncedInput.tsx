import { useEffect, useState } from "react";
import type { ComponentProps } from "react";

import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

export function DebouncedInput({
	value: initialValue,
	onChange,
	debounce = 300,
	isLoading = false,
	...props
}: {
	value: string | number;
	onChange: (value: string | number) => void;
	debounce?: number;
	isLoading?: boolean;
} & Omit<ComponentProps<typeof Input>, "onChange">) {
	const [value, setValue] = useState(initialValue);

	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	useEffect(() => {
		const timeout = setTimeout(() => {
			if (value !== initialValue) {
				onChange(value);
			}
		}, debounce);

		return () => clearTimeout(timeout);
	}, [value, debounce, onChange, initialValue]);

	return (
		<div className="relative">
			<Input
				{...props}
				value={value}
				onChange={(e) => setValue(e.target.value)}
			/>
			{isLoading && (
				<Spinner className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
			)}
		</div>
	);
}
