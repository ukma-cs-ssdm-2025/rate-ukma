import { hasDocument } from "@/lib/environment";

let lockCount = 0;
let previousOverflow: string | null = null;

export function lockBodyScroll(): () => void {
	if (!hasDocument()) {
		return () => {};
	}

	lockCount += 1;

	if (lockCount === 1) {
		previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
	}

	return () => {
		if (!hasDocument()) {
			return;
		}

		lockCount = Math.max(0, lockCount - 1);

		if (lockCount === 0) {
			document.body.style.overflow = previousOverflow ?? "";
			previousOverflow = null;
		}
	};
}
