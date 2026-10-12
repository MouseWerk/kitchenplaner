// PNG export: rasterizes an SVG document (from svg.ts) in the webview, so the PNG shows
// exactly what the SVG export shows.

/**
 * Renders an SVG document to PNG bytes `widthPx` wide (height from the SVG's aspect ratio) on
 * the given background. Rejects when the SVG cannot be loaded or the canvas is unavailable.
 */
export async function svgToPng(svg: string, widthPx: number, background = "#fff"): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImage(url);
    const { w, h } = svgSize(svg, img);
    const width = Math.max(1, Math.round(widthPx));
    const height = Math.max(1, Math.round((width * h) / w));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PNG export: no 2D canvas available");
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export: encoding failed"))), "image/png"));
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("PNG export: the SVG could not be loaded"));
    img.src = url;
  });
}

/**
 * The aspect ratio source: the viewBox, since width/height are in mm and an image's natural
 * size for mm units differs between browsers.
 */
function svgSize(svg: string, img: HTMLImageElement): { w: number; h: number } {
  const m = /viewBox="\s*[-\d.e]+[\s,]+[-\d.e]+[\s,]+([\d.e]+)[\s,]+([\d.e]+)\s*"/.exec(svg);
  if (m) {
    const w = Number(m[1]);
    const h = Number(m[2]);
    if (w > 0 && h > 0) return { w, h };
  }
  return { w: img.naturalWidth || 1, h: img.naturalHeight || 1 };
}
