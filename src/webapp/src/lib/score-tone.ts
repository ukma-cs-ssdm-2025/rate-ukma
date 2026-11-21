export function getDifficultyTone(value?: number | null): string {
	if (!value) {
		return "text-muted-foreground";
	}

	if (value >= 4) {
		return "text-destructive";
	}

	if (value >= 3) {
		return "text-chart-5";
	}

	return "text-primary";
}

export function getUsefulnessTone(value?: number | null): string {
	if (!value) {
		return "text-muted-foreground";
	}

	if (value >= 4) {
		return "text-primary";
	}

	if (value >= 3) {
		return "text-chart-2";
	}

	return "text-muted-foreground";
}
