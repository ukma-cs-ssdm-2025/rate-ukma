let lockCount = 0;
let previousOverflow: string | null = null;

export function lockBodyScroll(): () => void {
	if (typeof document === "undefined") {
		return () => {};
	}

	lockCount += 1;

	if (lockCount === 1) {
		previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
	}

	return () => {
		if (typeof document === "undefined") {
			return;
		}

		lockCount = Math.max(0, lockCount - 1);

		if (lockCount === 0) {
			document.body.style.overflow = previousOverflow ?? "";
			previousOverflow = null;
		}
	};
}
