/**
 * Minimal typings for the AR.js three.js build. The upstream package ships no
 * declarations; only the surface this app uses is described here.
 */
declare module '@ar-js-org/ar.js/three.js/build/ar-threex.js' {
  import type { Matrix4, Object3D } from 'three';

  export class ArToolkitSource {
    constructor(parameters: {
      sourceType: 'webcam' | 'image' | 'video';
      sourceUrl?: string;
      sourceWidth?: number;
      sourceHeight?: number;
      displayWidth?: number;
      displayHeight?: number;
    });
    ready: boolean;
    domElement: HTMLVideoElement | HTMLImageElement;
    init(onReady: () => void, onError?: (error: unknown) => void): this;
    onResizeElement(): void;
    copyElementSizeTo(element: HTMLElement): void;
  }

  export class ArToolkitContext {
    constructor(parameters: {
      cameraParametersUrl: string;
      detectionMode?: 'color' | 'color_and_matrix' | 'mono' | 'mono_and_matrix';
      matrixCodeType?: string;
      maxDetectionRate?: number;
      canvasWidth?: number;
      canvasHeight?: number;
      imageSmoothingEnabled?: boolean;
    });
    arController: { canvas: HTMLCanvasElement } | null;
    init(onCompleted: () => void): void;
    update(srcElement: HTMLElement): boolean;
    getProjectionMatrix(): Matrix4;
    dispose(): void;
  }

  export class ArMarkerControls {
    constructor(
      context: ArToolkitContext,
      object3d: Object3D,
      parameters: {
        type: 'pattern' | 'barcode' | 'unknown';
        patternUrl?: string;
        barcodeValue?: number;
        changeMatrixMode?: 'modelViewMatrix' | 'cameraTransformMatrix';
        minConfidence?: number;
        smooth?: boolean;
      },
    );
    dispose(): void;
  }

  export class ArSmoothedControls {
    constructor(
      object3d: Object3D,
      parameters?: {
        lerpPosition?: number;
        lerpQuaternion?: number;
        lerpScale?: number;
        minVisibleDelay?: number;
        minUnvisibleDelay?: number;
      },
    );
    update(target: Object3D): void;
  }
}
