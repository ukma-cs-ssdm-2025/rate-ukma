import { toast } from "sonner";

/** Copy text, silently. True when the clipboard took it; the caller confirms inline. */
export const copyTextSilent = async (text: string): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
};

/** Failure-only toast for a copy that returned false. Success stays inline. */
export const toastCopyFailed = (): void => {
	toast.error("Не вдалося скопіювати");
};
