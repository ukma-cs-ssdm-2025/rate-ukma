export type SessionExpiryListener = () => void;

let sessionExpiryListener: SessionExpiryListener | null = null;

export const setSessionExpiryListener = (
    listener: SessionExpiryListener | null,
) => {
    sessionExpiryListener = listener;
};

export const notifySessionExpired = () => {
    if (sessionExpiryListener) {
        sessionExpiryListener();
    }
};
