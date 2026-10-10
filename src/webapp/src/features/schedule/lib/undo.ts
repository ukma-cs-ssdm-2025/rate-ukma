import { toast } from "sonner";
import { usePlanDraft } from "@/features/schedule/stores/plan";

/**
 * Run a change that throws away the student's own work (clearing every
 * group, taking САЗ's plan, removing a discipline or a correction) and offer
 * it back for a few seconds. The plan returns exactly as it was, whatever
 * the change touched; the debounced save then stores the restored plan.
 * Any later change to the plan (another edit, a lock, another semester)
 * makes the snapshot stale, so the offer goes away with it.
 */
export const undoable = (message: string, change: () => void): void => {
	const before = usePlanDraft.getState().snapshot();
	change();
	const after = usePlanDraft.getState();
	const id = toast(message, {
		duration: 6000,
		action: {
			label: "Повернути",
			onClick: () => usePlanDraft.getState().restore(before),
		},
		onDismiss: () => unsubscribe(),
		onAutoClose: () => unsubscribe(),
	});
	const unsubscribe = usePlanDraft.subscribe((state) => {
		const stale =
			state.picked !== after.picked ||
			state.selection !== after.selection ||
			state.hidden !== after.hidden ||
			state.overrides !== after.overrides ||
			state.custom !== after.custom ||
			state.locked !== after.locked ||
			state.hydratedFor !== after.hydratedFor;
		if (!stale) return;
		unsubscribe();
		toast.dismiss(id);
	});
};
