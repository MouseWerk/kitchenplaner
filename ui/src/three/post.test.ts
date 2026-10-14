import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { OutputShader } from "three/examples/jsm/shaders/OutputShader.js";
import { captureSize, encodePng, flipRows, PostChain, premultipliedOutputShader } from "./post";

// The chain builds its buffers without touching WebGL; the composer only asks the renderer for
// its pixel ratio and size, so a stub stands in for it.
const stubRenderer = () =>
  ({
    getPixelRatio: () => 2,
    getSize: (v: THREE.Vector2) => v.set(800, 600),
  }) as unknown as THREE.WebGLRenderer;

describe("export size", () => {
  it("renders the requested width with the view's aspect, not the canvas's size", () => {
    expect(captureSize({ width: 1550, height: 1040 }, 1, 3200, 8192)).toEqual({ width: 3200, height: 2147 });
    // The pixel ratio does not change a requested width.
    expect(captureSize({ width: 1550, height: 1040 }, 2, 3200, 8192)).toEqual({ width: 3200, height: 2147 });
  });

  it("takes the view's device pixels when no width is asked for", () => {
    expect(captureSize({ width: 800, height: 500 }, 2, undefined, 8192)).toEqual({ width: 1600, height: 1000 });
  });

  it("keeps both sides within the GPU's limit, aspect kept", () => {
    expect(captureSize({ width: 1000, height: 500 }, 1, 9000, 4096)).toEqual({ width: 4096, height: 2048 });
    // A tall view: the height is the side that hits the limit.
    expect(captureSize({ width: 500, height: 1000 }, 1, 3200, 4096)).toEqual({ width: 2048, height: 4096 });
  });
});

describe("post chain", () => {
  it("draws at the requested size into multisampled buffers, ambient occlusion included", () => {
    const chain = new PostChain(stubRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), 3200, 2147, true);
    const t = chain.targets();
    expect(t.map((x) => x.name)).toEqual(["scene", "swap", "depth", "ao", "denoise"]);
    for (const x of t) expect([x.name, x.width, x.height]).toEqual([x.name, 3200, 2147]);
    // Antialiased like the canvas, also when the picture is larger than the screen.
    expect(t.filter((x) => x.name === "scene" || x.name === "swap").map((x) => x.samples)).toEqual([4, 4]);
    chain.dispose();
  });

  it("follows a resize, depth included", () => {
    const chain = new PostChain(stubRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), 1600, 1000, true);
    chain.setSize(1200, 700);
    for (const x of chain.targets()) expect([x.name, x.width, x.height]).toEqual([x.name, 1200, 700]);
    chain.dispose();
  });

  it("has no depth or occlusion buffers in the standard quality", () => {
    const chain = new PostChain(stubRenderer(), new THREE.Scene(), new THREE.PerspectiveCamera(), 640, 480, false);
    expect(chain.targets().map((x) => x.name)).toEqual(["scene", "swap"]);
    chain.dispose();
  });
});

describe("output over the background", () => {
  it("tone maps the covered colour and premultiplies it for blending", () => {
    const src = premultipliedOutputShader(OutputShader.fragmentShader);
    expect(src).toContain("source.rgb / max( coverage, 1e-4 )");
    // Unpremultiplied before tone mapping, premultiplied as the last step.
    expect(src.indexOf("coverage = clamp")).toBeLessThan(src.indexOf("AgXToneMapping"));
    expect(src.trimEnd().endsWith("gl_FragColor = vec4( gl_FragColor.rgb * coverage, coverage );\n}")).toBe(true);
    expect(src.lastIndexOf("sRGBTransferOETF")).toBeLessThan(src.lastIndexOf("* coverage"));
  });

  it("fails loudly when three's output shader changes", () => {
    expect(() => premultipliedOutputShader("void main() { gl_FragColor = vec4(1.0); }")).toThrow(/OutputShader changed/);
  });
});

describe("flipRows", () => {
  it("turns WebGL's bottom-up rows into image rows", () => {
    // 1 × 3 pixels, the red channel numbers the rows.
    const data = new Uint8Array([1, 0, 0, 255, 2, 0, 0, 255, 3, 0, 0, 255]);
    flipRows(data, 1, 3);
    expect([data[0], data[4], data[8]]).toEqual([3, 2, 1]);
  });
});

describe("encodePng", () => {
  it("encodes in a detached canvas: the document gains no element", async () => {
    // happy-dom has no 2D canvas; a stub stands in for it and records what was drawn.
    let drawn: ImageData | null = null;
    const ctx = { putImageData: (d: ImageData) => (drawn = d) };
    const real = document.createElement.bind(document);
    const created: HTMLElement[] = [];
    const spy = vi.spyOn(document, "createElement").mockImplementation((tag: string, o?: ElementCreationOptions) => {
      const el = real(tag, o);
      created.push(el);
      if (tag === "canvas") {
        Object.assign(el, {
          getContext: () => ctx,
          toBlob: (cb: (b: Blob) => void) => cb(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])])),
        });
      }
      return el;
    });
    const before = document.body.innerHTML;
    try {
      const png = await encodePng(new Uint8ClampedArray([1, 0, 0, 255, 2, 0, 0, 255]), 1, 2);
      expect([...png]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    } finally {
      spy.mockRestore();
    }
    expect(drawn!.width).toBe(1);
    // Flipped: the top image row is the last row WebGL read.
    expect(drawn!.data[0]).toBe(2);
    expect(created.every((el) => !el.isConnected)).toBe(true);
    expect(document.body.innerHTML).toBe(before);
  });
});
