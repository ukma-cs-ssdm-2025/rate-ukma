/**
 * Waffle flag that gates the homepage feed.
 *
 * Opt-in, following the `fe_`-prefixed convention: the feed renders only when
 * the flag resolves on, so it ships dark and can be disabled on demand by
 * turning the flag off (server-side, or via the `featureFlags` console helper
 * in non-live builds).
 */
export const FEED_FLAG = "fe_feed";
