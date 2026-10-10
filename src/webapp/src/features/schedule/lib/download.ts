/** Hand the browser a file; the object URL is revoked once the click has fired. */
export const saveBlob = (blob: Blob, filename: string): void => {
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
};

/** Rasterise a DOM node as it is on screen. html-to-image loads on first
 *  use so the bundle skips it until the export runs. A whole-semester grid
 *  is taller than what WebKit rasterises as one SVG, so the render itself
 *  shrinks to fit: `pixelRatio` alone only scales the canvas while the SVG
 *  stays full-size and still throws. */
const MAX_SIDE = 16384;

export interface PngRenderOptions {
	readonly pixelRatio?: number;
	readonly width?: number;
	readonly height?: number;
	readonly style?: Partial<CSSStyleDeclaration>;
}
/** The toBlob options for a node of this size: full sharpness while the
 *  longest side fits, a scaled render once it does not. Pure, so the
 *  boundary math is pinned by a unit test instead of a browser. */
export const pngRenderOptions = (
	width: number,
	height: number,
): PngRenderOptions => {
	const longest = Math.max(width, height, 1);
	const ratio = Math.min(2, MAX_SIDE / longest);
	if (ratio >= 1) return { pixelRatio: ratio };
	return {
		width: Math.max(1, Math.floor(width * ratio)),
		height: Math.max(1, Math.floor(height * ratio)),
		style: { transform: `scale(${ratio})`, transformOrigin: "top left" },
	};
};

export const nodeAsPng = async (node: HTMLElement): Promise<Blob> => {
	const { toBlob } = await import("html-to-image");
	const rect = node.getBoundingClientRect();
	const blob = await toBlob(node, {
		backgroundColor: "#ffffff",
		...pngRenderOptions(rect.width, rect.height),
	});
	if (!blob) throw new Error("PNG rendering produced no image");
	return blob;
};
