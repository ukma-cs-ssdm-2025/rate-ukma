import * as React from "react";

import { Star } from "lucide-react";

const SCORE_OPTIONS = [1, 2, 3, 4, 5] as const;

function getShortDescription(
	descriptions: Record<number, string>,
	value: number,
): string {
	const full = descriptions[value] ?? "";
	const [head] = full.split(" - ");
	return head?.trim() || full;
}

export function ScoreInput({
	value,
	onChange,
	onBlur,
	descriptions,
	label,
	labelId,
	"data-testid": dataTestId,
	...rest
}: Readonly<{
	label: React.ReactNode;
	value: number;
	onChange: (value: number) => void;
	onBlur?: () => void;
	descriptions: Record<number, string>;
	labelId: string;
	"data-testid"?: string;
	id?: string;
	"aria-describedby"?: string;
	"aria-invalid"?: boolean;
}>) {
	const [hovered, setHovered] = React.useState<number | null>(null);
	const [dragging, setDragging] = React.useState(false);
	const buttons = React.useRef<Array<HTMLButtonElement | null>>([]);
	const shown = hovered ?? value;

	React.useEffect(() => {
		if (!dragging) {
			return;
		}
		const stop = () => setDragging(false);
		globalThis.addEventListener("pointerup", stop);
		return () => globalThis.removeEventListener("pointerup", stop);
	}, [dragging]);

	const select = (next: number) => {
		onChange(next);
		buttons.current[next - 1]?.focus();
	};

	const onRadioKeyDown = (event: React.KeyboardEvent) => {
		switch (event.key) {
			case "ArrowRight":
			case "ArrowUp":
				event.preventDefault();
				select(Math.min(5, value + 1));
				break;
			case "ArrowLeft":
			case "ArrowDown":
				event.preventDefault();
				select(Math.max(1, value - 1));
				break;
			case "Home":
				event.preventDefault();
				select(1);
				break;
			case "End":
				event.preventDefault();
				select(5);
				break;
		}
	};

	return (
		<div
			className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
			data-testid={dataTestId}
		>
			<div className="min-w-0">
				{label}
				<p
					aria-live="polite"
					className="mt-0.5 flex items-baseline gap-1.5 text-sm text-muted-foreground"
				>
					{shown > 0 ? (
						<>
							<span className="font-medium text-foreground tabular-nums">
								{shown}
							</span>
							<span>{getShortDescription(descriptions, shown)}</span>
						</>
					) : (
						<span>Оберіть від 1 до 5</span>
					)}
				</p>
			</div>
			<div
				role="radiogroup"
				aria-labelledby={labelId}
				onBlur={onBlur}
				onPointerLeave={() => {
					setHovered(null);
					setDragging(false);
				}}
				onPointerUp={() => setDragging(false)}
				className="-ml-1 flex touch-pan-y select-none gap-0.5 sm:ml-0"
				{...rest}
			>
				{SCORE_OPTIONS.map((score) => {
					const isFilled = score <= shown;
					return (
						<button
							key={score}
							ref={(node) => {
								buttons.current[score - 1] = node;
							}}
							type="button"
							role="radio"
							aria-checked={score === value}
							aria-label={`${score} з 5`}
							tabIndex={score === (value || 1) ? 0 : -1}
							onKeyDown={onRadioKeyDown}
							onClick={() => onChange(score)}
							onPointerDown={() => {
								setDragging(true);
								onChange(score);
							}}
							onPointerEnter={() => {
								setHovered(score);
								if (dragging) {
									onChange(score);
								}
							}}
							className="min-h-10 min-w-10 rounded-md p-1 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none sm:min-h-0 sm:min-w-0 [@media(hover:hover)]:hover:scale-110 active:scale-95 motion-reduce:transform-none"
						>
							<Star
								aria-hidden="true"
								className={
									isFilled
										? "size-8 fill-primary text-primary transition-colors duration-100 motion-reduce:transition-none sm:size-7"
										: "size-8 fill-transparent text-muted-foreground/40 transition-colors duration-100 motion-reduce:transition-none sm:size-7"
								}
							/>
						</button>
					);
				})}
			</div>
		</div>
	);
}
