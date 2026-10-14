// The post-processing chain of the 3D view and of the PNG export: the scene into a multisampled
// HDR buffer, optionally ambient occlusion (GTAO), then tone mapping and sRGB onto the screen or
// into an offscreen target.
//
// The background is not part of the HDR picture. Drawn into the buffer it would be tone mapped
// like the walls: AgX turns the light theme's near-white canvas into the gray of the walls and
// the room's outline disappears, and the background would differ between the quality settings
// (the standard path clears with the colour as it is). So the scene is drawn onto a transparent
// buffer, and the output pass tone maps the covered pixels only and lays them over the
// background colour, which reaches the picture exactly as the theme defines it.
//
// The export renders through a chain of its own at the requested size, never through the
// canvas: the canvas's drawing buffer may be smaller than asked for (browsers clamp it), and
// reading a WebGL canvas back can return the last composited frame scaled up.

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

/** Ambient occlusion: radius (m) and strength tuned for counters against walls and floors. */
const AO = { radius: 0.35, distanceExponent: 1.5, thickness: 1, scale: 1.1, samples: 16 };
/** Samples of the multisampled HDR buffers: edges as smooth as the canvas's own antialiasing. */
const MSAA = 4;

const OUTPUT_READ = "gl_FragColor = texture2D( tDiffuse, vUv );";

/**
 * The output shader for a buffer with premultiplied coverage (alpha): the colour is divided by
 * the coverage before tone mapping, so an antialiased edge is tone mapped like the surface it
 * belongs to, and multiplied again afterwards for blending over the background. Throws when
 * three's shader no longer has the expected line, so an upgrade fails the tests, not the look.
 */
export function premultipliedOutputShader(fragment: string): string {
  if (!fragment.includes(OUTPUT_READ)) throw new Error("OutputShader changed: the coverage patch no longer applies.");
  const read = [
    "vec4 source = texture2D( tDiffuse, vUv );",
    "float coverage = clamp( source.a, 0.0, 1.0 );",
    "gl_FragColor = vec4( source.rgb / max( coverage, 1e-4 ), 1.0 );",
  ].join("\n");
  const end = fragment.lastIndexOf("}");
  return fragment.slice(0, end).replace(OUTPUT_READ, read) + "gl_FragColor = vec4( gl_FragColor.rgb * coverage, coverage );\n}";
}

/** An output pass that tone maps covered pixels and blends them (premultiplied) over the target. */
function coverageOutputPass(): OutputPass {
  const pass = new OutputPass();
  const m = pass.material;
  m.fragmentShader = premultipliedOutputShader(m.fragmentShader);
  m.transparent = true;
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  return pass;
}

/**
 * The size in pixels of a capture `requested` px wide (or the view's own device pixels) with the
 * view's aspect, both sides within `maxSize` (the GPU's texture and renderbuffer limits and the
 * app's cap). The aspect is kept when a side has to shrink.
 */
export function captureSize(view: { width: number; height: number }, ratio: number, requested: number | undefined, maxSize: number): { width: number; height: number } {
  const aspect = view.width / view.height;
  let w = requested ?? view.width * ratio;
  let h = w / aspect;
  const shrink = Math.min(1, maxSize / w, maxSize / h);
  w *= shrink;
  h *= shrink;
  return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
}

/** RGBA rows read from WebGL (bottom row first) in image order (top row first), in place. */
export function flipRows(data: Uint8Array | Uint8ClampedArray, width: number, height: number): void {
  const stride = width * 4;
  const row = new Uint8Array(stride);
  for (let top = 0, bottom = height - 1; top < bottom; top++, bottom--) {
    const a = top * stride;
    const b = bottom * stride;
    row.set(data.subarray(a, a + stride));
    data.copyWithin(a, b, b + stride);
    data.set(row, b);
  }
}

/**
 * PNG bytes of RGBA pixels as WebGL reads them (bottom row first; flipped in place). The 2D
 * canvas that encodes them is never attached to the document.
 */
export async function encodePng(pixels: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): Promise<Uint8Array> {
  flipRows(pixels, width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("3D capture: no 2D canvas to encode the PNG.");
  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("3D capture: the picture could not be encoded as PNG.");
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Scene -> HDR buffer (multisampled) -> optional GTAO -> tone mapping over the background.
 * Sizes are device pixels.
 */
export class PostChain {
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly ao: GTAOPass | null;
  private readonly output = coverageOutputPass();
  private readonly clearColor = new THREE.Color();
  private readonly encoded = new THREE.Color();

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    camera: THREE.Camera,
    width: number,
    height: number,
    withAo: boolean,
  ) {
    // The depth of the main render feeds the ambient occlusion, which then rebuilds normals from
    // it instead of drawing the whole scene a second time (half the CPU cost of the pass).
    const depth = withAo ? new THREE.DepthTexture(width, height) : undefined;
    const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: MSAA, ...(depth ? { depthTexture: depth } : {}) });
    const composer = new EffectComposer(renderer, target);
    // The composer clones the target for its second buffer, depth texture included, and the
    // clone shares the depth's storage, which breaks the multisample resolve. Only the first
    // buffer needs depth: the scene is always drawn into it.
    composer.renderTarget2.dispose();
    composer.renderTarget2 = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: MSAA });
    composer.writeBuffer = composer.renderTarget2;
    // The output pass is called by `render`, not by the composer: nothing goes to the screen.
    composer.renderToScreen = false;
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    // Transparent black: what is left uncovered is the background (see the top of this file).
    this.renderPass = new RenderPass(scene, camera, null, new THREE.Color(0, 0, 0), 0);
    composer.addPass(this.renderPass);
    this.ao = null;
    if (withAo && depth) {
      const ao = new GTAOPass(scene, camera, width, height);
      ao.setGBuffer(depth);
      ao.updateGtaoMaterial(AO);
      composer.addPass(ao);
      this.ao = ao;
    }
    this.composer = composer;
  }

  setSize(width: number, height: number): void {
    // three resizes a target's colour textures but not its depth texture; the resize disposes
    // the target, so the depth is allocated again at the new size.
    const depth = this.composer.renderTarget1.depthTexture;
    if (depth && (depth.image.width !== width || depth.image.height !== height)) {
      depth.image.width = width;
      depth.image.height = height;
    }
    this.composer.setSize(width, height);
  }

  /** Draws the scene as `camera` sees it over `background`, onto the screen or into `target`. */
  render(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, background: THREE.Color, target: THREE.WebGLRenderTarget | null = null): void {
    const r = this.renderer;
    this.syncCamera(camera);
    const sceneBackground = this.scene.background;
    this.scene.background = null;
    const autoClear = r.autoClear;
    r.autoClear = false;
    r.getClearColor(this.clearColor);
    const clearAlpha = r.getClearAlpha();
    try {
      this.composer.render();
      r.setRenderTarget(target);
      // The screen gets the clear colour converted to sRGB; a render target takes it as it is
      // (linear), while the output pass writes sRGB-encoded values into it. So the background
      // is encoded by hand there, or the export's background would come out far too dark.
      r.setClearColor(target ? this.encoded.copy(background).convertLinearToSRGB() : background, 1);
      r.clear(true, false, false);
      this.output.renderToScreen = target === null;
      this.output.render(r, target as THREE.WebGLRenderTarget, this.composer.readBuffer, 0, false);
    } finally {
      r.setClearColor(this.clearColor, clearAlpha);
      r.autoClear = autoClear;
      this.scene.background = sceneBackground;
    }
  }

  /** The sizes and samples of every buffer the chain draws into (for tests). */
  targets(): { name: string; width: number; height: number; samples: number }[] {
    const t = (name: string, rt: THREE.WebGLRenderTarget) => ({ name, width: rt.width, height: rt.height, samples: rt.samples });
    const depth = this.composer.renderTarget1.depthTexture;
    const out = [t("scene", this.composer.renderTarget1), t("swap", this.composer.renderTarget2)];
    const image = depth?.image as { width: number; height: number } | undefined;
    if (image) out.push({ name: "depth", width: image.width, height: image.height, samples: MSAA });
    if (this.ao) out.push(t("ao", this.ao.gtaoRenderTarget), t("denoise", this.ao.pdRenderTarget));
    return out;
  }

  dispose(): void {
    this.composer.renderTarget1.depthTexture?.dispose();
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    for (const p of this.composer.passes) p.dispose();
    this.output.dispose();
    this.composer.dispose();
  }

  /** GTAO reads the camera's projection only when sized; zoom and projection switches change it. */
  private syncCamera(cam: THREE.PerspectiveCamera | THREE.OrthographicCamera): void {
    this.renderPass.camera = cam;
    const ao = this.ao;
    if (!ao) return;
    ao.camera = cam;
    const u = ao.gtaoMaterial.uniforms;
    u.cameraNear.value = cam.near;
    u.cameraFar.value = cam.far;
    u.cameraProjectionMatrix.value.copy(cam.projectionMatrix);
    u.cameraProjectionMatrixInverse.value.copy(cam.projectionMatrixInverse);
    ao.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(cam.projectionMatrixInverse);
    const perspective = cam instanceof THREE.PerspectiveCamera ? 1 : 0;
    if (ao.gtaoMaterial.defines.PERSPECTIVE_CAMERA !== perspective) {
      ao.gtaoMaterial.defines.PERSPECTIVE_CAMERA = perspective;
      ao.gtaoMaterial.needsUpdate = true;
    }
  }
}
