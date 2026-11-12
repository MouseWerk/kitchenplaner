// Keeps rendered catalog thumbnails across sessions in the webview's IndexedDB, so a start after
// the first renders none of them: no WebGL context, no shader compilation, no hitch.
//
// A thumbnail is a picture of the model code and the look of one build: every record carries
// the build it was rendered by, and a start of another build drops the old ones. In a production
// build the id is the URL of the hashed chunk this module ends up in, which changes with any
// code it imports (the models and the look among it). The dev server has no such id, and models
// change there all the time: development builds keep thumbnails for the session only.
//
// The images reach the page as `blob:` URLs, which the CSP allows for images. A store that
// fails (no IndexedDB, a private window, a full disk) costs only the cache: everything renders
// as on a first start.

/** Rendered images by queue key, kept across sessions. */
export interface ThumbStore {
  /** Every image of this build; images of other builds are removed. */
  load(): Promise<Map<string, Blob>>;
  /** Keeps a rendered image, given as a PNG data URL; in the background, errors ignored. */
  save(key: string, dataUrl: string): void;
  /** Forgets a kept image the page could not show; in the background, errors ignored. */
  drop?(key: string): void;
}

const DB_NAME = "kitchenplaner-thumbnails";
const STORE = "thumbs";

/** Stored as bytes, not as a Blob: some webviews' IndexedDB had trouble with Blobs. */
interface Row {
  build: string;
  type: string;
  bytes: ArrayBuffer;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, fail) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fail(r.error);
  });
}

function open(): Promise<IDBDatabase> {
  const r = indexedDB.open(DB_NAME, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE);
  return request(r);
}

/** The IndexedDB store for `build`; null where there is none. */
export function indexedDbStore(build: string): ThumbStore | null {
  if (typeof indexedDB === "undefined") return null;
  let db: Promise<IDBDatabase> | null = null;
  const conn = () => (db ??= open());
  return {
    async load() {
      const out = new Map<string, Blob>();
      try {
        const tx = (await conn()).transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const [keys, rows] = await Promise.all([request(store.getAllKeys()), request(store.getAll() as IDBRequest<Row[]>)]);
        keys.forEach((k, i) => {
          const row = rows[i];
          // A record cut short or garbled on disk would show as a broken image for the whole
          // build: only a complete PNG header counts.
          if (row?.build === build && row.bytes instanceof ArrayBuffer && isPng(row.bytes)) out.set(String(k), new Blob([row.bytes], { type: row.type }));
          else store.delete(k);
        });
      } catch {
        // No cache this session; the thumbnails render as on a first start.
      }
      return out;
    },
    save(key, dataUrl) {
      const image = decodeDataUrl(dataUrl);
      if (!image || !isPng(image.bytes)) return;
      conn()
        .then((d) => d.transaction(STORE, "readwrite").objectStore(STORE).put({ build, ...image } satisfies Row, key))
        .catch(() => {});
    },
    drop(key) {
      conn()
        .then((d) => d.transaction(STORE, "readwrite").objectStore(STORE).delete(key))
        .catch(() => {});
    },
  };
}

/** The eight bytes every PNG file starts with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Do the bytes start like a PNG file, with more than the signature after it? */
export function isPng(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength <= PNG_SIGNATURE.length) return false;
  const head = new Uint8Array(bytes, 0, PNG_SIGNATURE.length);
  return PNG_SIGNATURE.every((b, i) => head[i] === b);
}

/** The bytes and media type of a base64 data URL; null for anything else. */
export function decodeDataUrl(url: string): { type: string; bytes: ArrayBuffer } | null {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(url);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { type: m[1], bytes: bytes.buffer };
  } catch {
    return null;
  }
}

/** The id of this build for the store; null in development builds (see above). */
export function buildId(dev: boolean, moduleUrl: string): string | null {
  if (dev) return null;
  try {
    return new URL(moduleUrl).pathname;
  } catch {
    return null;
  }
}
