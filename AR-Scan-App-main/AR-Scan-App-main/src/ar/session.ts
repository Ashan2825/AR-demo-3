/**
 * Marker AR session (web only).
 *
 * Wires AR.js / ARToolKit marker tracking to a three.js scene: the webcam feed
 * is scanned for the Hiro marker every frame, and the marker's pose is written
 * straight into the transform of a group that carries the red cube. The cube
 * therefore stays glued to the marker while the phone moves.
 */
import * as THREE from 'three';
// UMD build. It `require`s three, so both the nested copy (removed by the
// `overrides` field in package.json) and the export condition (pinned in
// metro.config.js) have to be handled to keep a single THREE instance.
import * as THREEx from '@ar-js-org/ar.js/three.js/build/ar-threex.js';

export type ArPhase = 'starting' | 'running' | 'error';

export type ArState = {
  phase: ArPhase;
  /** True while the Hiro marker is in view and being tracked. */
  markerVisible: boolean;
  /** Render loop rate, rounded. */
  fps: number;
  error?: string;
};

/**
 * `webcam` is the real thing. `test` replays a still frame that contains a Hiro
 * marker, which makes the tracking pipeline verifiable on machines with no
 * camera (append `?source=test` to the URL).
 */
export type ArSourceKind = 'webcam' | 'test';

export type ArOptions = {
  /** Slow idle spin so the cube reads as 3D. */
  spin: boolean;
  source: ArSourceKind;
};

const CAMERA_PARAMETERS_URL = 'data/camera_para.dat';
const HIRO_PATTERN_URL = 'data/patt.hiro';
const TEST_SCENE_URL = 'data/test-scene.jpg';

export class ArSession {
  private renderer?: THREE.WebGLRenderer;
  private source?: THREEx.ArToolkitSource;
  private context?: THREEx.ArToolkitContext;
  private markerControls?: THREEx.ArMarkerControls;
  private smoothedControls?: THREEx.ArSmoothedControls;
  private frame = 0;
  private disposed = false;
  private cube?: THREE.Mesh;
  private onResize = () => this.resize();

  options: ArOptions = { spin: true, source: 'webcam' };

  constructor(
    private readonly onState: (state: ArState) => void,
  ) {}

  async start(container: HTMLElement) {
    const state: ArState = { phase: 'starting', markerVisible: false, fps: 0 };
    this.onState(state);

    // --- renderer -----------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    Object.assign(renderer.domElement.style, {
      position: 'absolute',
      inset: '0px',
      zIndex: '1',
    } as CSSStyleDeclaration);
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    // ArToolkitContext drives this camera's projection matrix directly, so it
    // must stay a bare Camera rather than a PerspectiveCamera.
    const camera = new THREE.Camera();
    scene.add(camera);

    scene.add(new THREE.AmbientLight(0xffffff, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(1.5, 3, 2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffd9d9, 0.8);
    rim.position.set(-2, 1.5, -1.5);
    scene.add(rim);

    // --- webcam source ------------------------------------------------------
    const useTestScene = this.options.source === 'test';
    // A phone held upright gets a portrait feed; asking for a landscape one
    // makes AR.js scale the video up massively to cover the screen.
    const portrait = !useTestScene && window.innerHeight > window.innerWidth;
    const captureWidth = portrait ? 480 : 640;
    const captureHeight = portrait ? 640 : 480;

    const source = new THREEx.ArToolkitSource({
      sourceType: useTestScene ? 'image' : 'webcam',
      sourceUrl: useTestScene ? TEST_SCENE_URL : undefined,
      sourceWidth: captureWidth,
      sourceHeight: captureHeight,
      displayWidth: container.clientWidth,
      displayHeight: container.clientHeight,
    });
    this.source = source;

    await new Promise<void>((resolve, reject) => {
      source.init(() => setTimeout(resolve, 200), reject);
    }).catch((err: unknown) => {
      this.fail(cameraErrorMessage(err));
      throw err;
    });
    if (this.disposed) return;

    // AR.js parks the video (or test image) on document.body; move it inside our
    // own layer so it sits behind the canvas instead of behind the whole page.
    const media = source.domElement;
    Object.assign(media.style, {
      position: 'absolute',
      top: '0px',
      left: '0px',
      zIndex: '0',
    } as CSSStyleDeclaration);
    media.setAttribute('playsinline', 'true');
    container.appendChild(media);

    // AR.js sizes everything from the media's intrinsic dimensions, which are
    // still zero until the frame or the still image has actually loaded.
    await waitForMediaSize(media);
    if (this.disposed) return;

    // --- tracking context ---------------------------------------------------
    const context = new THREEx.ArToolkitContext({
      cameraParametersUrl: CAMERA_PARAMETERS_URL,
      detectionMode: 'mono',
      maxDetectionRate: 60,
      canvasWidth: captureWidth,
      canvasHeight: captureHeight,
      imageSmoothingEnabled: true,
    });
    this.context = context;

    await new Promise<void>((resolve) => {
      context.init(() => {
        camera.projectionMatrix.copy(context.getProjectionMatrix());
        resolve();
      });
    });
    if (this.disposed) return;

    // --- marker + cube ------------------------------------------------------
    const markerRoot = new THREE.Group();
    scene.add(markerRoot);
    this.markerControls = new THREEx.ArMarkerControls(context, markerRoot, {
      type: 'pattern',
      patternUrl: HIRO_PATTERN_URL,
      changeMatrixMode: 'modelViewMatrix',
    });

    // The raw marker pose jitters; a smoothed copy carries the cube.
    const smoothedRoot = new THREE.Group();
    scene.add(smoothedRoot);
    this.smoothedControls = new THREEx.ArSmoothedControls(smoothedRoot, {
      lerpPosition: 0.45,
      lerpQuaternion: 0.35,
      lerpScale: 1,
      minVisibleDelay: 0.0,
      minUnvisibleDelay: 0.2,
    });

    const cube = buildRedCube();
    smoothedRoot.add(cube);
    this.cube = cube;

    window.addEventListener('resize', this.onResize);
    this.resize();
    // The ARToolKit canvas appears a tick after init on some browsers.
    setTimeout(() => !this.disposed && this.resize(), 300);

    // --- render loop --------------------------------------------------------
    let last = performance.now();
    let fpsAccum = 0;
    let fpsFrames = 0;
    let reportedVisible: boolean | null = null;
    let reportedFps = 0;

    const tick = () => {
      if (this.disposed) return;
      this.frame = requestAnimationFrame(tick);

      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (source.ready) {
        context.update(source.domElement);
        this.smoothedControls?.update(markerRoot);
      }

      if (this.options.spin) {
        cube.rotation.y += dt * 0.8;
      }
      // Gentle bob so the cube never looks like a flat sticker.
      cube.position.y = CUBE_SIZE / 2 + Math.sin(now / 700) * 0.03;

      renderer.render(scene, camera);

      fpsAccum += dt;
      fpsFrames++;
      if (fpsAccum >= 0.5) {
        reportedFps = Math.round(fpsFrames / fpsAccum);
        fpsAccum = 0;
        fpsFrames = 0;
      }
      const visible = smoothedRoot.visible;
      if (visible !== reportedVisible || reportedFps !== state.fps) {
        reportedVisible = visible;
        state.markerVisible = visible;
        state.fps = reportedFps;
        state.phase = 'running';
        this.onState({ ...state });
      }
    };

    if (__DEV__) {
      // Handy when tuning placement from the browser console.
      (window as any).__ar = { scene, camera, markerRoot, smoothedRoot, cube, context, source };
    }

    state.phase = 'running';
    this.onState({ ...state });
    tick();
  }

  setSpin(spin: boolean) {
    this.options.spin = spin; // the cube keeps whatever angle it stopped at
  }

  private resize() {
    const { renderer, source, context } = this;
    if (!renderer || !source) return;

    // AR.js letterboxes the feed across the screen and copies that geometry to
    // the overlay canvases, which keeps the WebGL layer registered with the
    // pixels ARToolKit actually analysed.
    source.onResizeElement();
    source.copyElementSizeTo(renderer.domElement);
    if (context?.arController) {
      source.copyElementSizeTo(context.arController.canvas);
    }

    const style = renderer.domElement.style;
    const width = parseInt(style.width, 10) || window.innerWidth;
    const height = parseInt(style.height, 10) || window.innerHeight;
    renderer.setSize(width, height, false); // style is owned by copyElementSizeTo
  }

  private fail(message: string) {
    this.onState({ phase: 'error', markerVisible: false, fps: 0, error: message });
  }

  stop() {
    this.disposed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    window.removeEventListener('resize', this.onResize);
    this.markerControls?.dispose?.();
    this.context?.dispose?.();
    const media = this.source?.domElement;
    if (media && 'srcObject' in media) {
      const stream = media.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    }
    media?.remove();
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }
}

/** Resolve once the video/image reports non-zero intrinsic dimensions. */
async function waitForMediaSize(
  media: HTMLVideoElement | HTMLImageElement,
  timeoutMs = 6000,
): Promise<void> {
  const size = () =>
    media instanceof HTMLImageElement
      ? media.naturalWidth
      : (media as HTMLVideoElement).videoWidth;

  const started = Date.now();
  while (size() === 0 && Date.now() - started < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Marker units: 1.0 is the width of the printed Hiro square. */
const CUBE_SIZE = 0.7;

function buildRedCube(): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const material = new THREE.MeshStandardMaterial({
    color: 0xe11d1d,
    roughness: 0.35,
    metalness: 0.05,
    emissive: 0x3a0000,
  });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.y = CUBE_SIZE / 2; // sit on the marker plane instead of straddling it

  // Slightly inflated so the outline is not z-fighting with the faces it traces.
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0xffe3e3, transparent: true, opacity: 0.55 }),
  );
  edges.scale.setScalar(1.004);
  cube.add(edges);
  return cube;
}

/**
 * AR.js forwards whatever getUserMedia rejected with, which may be a
 * DOMException, a plain `{name, message}` object or a string.
 */
function cameraErrorMessage(err: unknown): string {
  const source = (err ?? {}) as { name?: string; message?: string };
  const name = typeof err === 'string' ? err : (source.name ?? '');
  const message = typeof err === 'string' ? err : (source.message ?? '');

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera permission was denied. Allow camera access for this site, then tap Try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'The camera is already in use by another app or tab.';
  }
  if (name === 'OverconstrainedError') {
    return 'No camera matched the requested settings. Try a different device.';
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Camera access needs a secure context. Open this page over HTTPS or on localhost.';
  }
  return message || 'Could not start the camera.';
}
