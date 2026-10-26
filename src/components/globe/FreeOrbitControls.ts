import * as THREE from 'three';

/**
 * Drop-in replacement for the subset of OrbitControls used by the globe engine,
 * but with NO pole limit: the camera orbits around its own up/right axes and its
 * `up` vector rotates with it, so the sphere can be spun a full 360° in every direction.
 */
export class FreeOrbitControls {
  enabled = true;
  target = new THREE.Vector3();
  minDistance = 0;
  maxDistance = Infinity;
  enableDamping = true;
  dampingFactor = 0.07;
  rotateSpeed = 1;
  zoomSpeed = 1;
  autoRotate = false;
  autoRotateSpeed = 2; // same units as OrbitControls (30s per orbit at 2.0)

  private camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private pendingYaw = 0;
  private pendingPitch = 0;

  private offset = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private right = new THREE.Vector3();
  private lastTime = performance.now();

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;
    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('wheel', this.onWheel, { passive: false });
    dom.addEventListener('contextmenu', this.onContextMenu);
  }

  dispose() {
    const dom = this.dom;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('pointercancel', this.onPointerUp);
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('contextmenu', this.onContextMenu);
  }

  update() {
    const cam = this.camera;
    const now = performance.now();
    const dtSec = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.offset.copy(cam.position).sub(this.target);
    let len = this.offset.length();
    if (len < 1e-6) len = 1e-6;
    this.dir.copy(this.offset).divideScalar(len);

    // Keep `up` perpendicular to the view direction (and valid if a fly-to made it degenerate)
    cam.up.addScaledVector(this.dir, -cam.up.dot(this.dir));
    if (cam.up.lengthSq() < 1e-8) {
      cam.up.set(0, 1, 0).addScaledVector(this.dir, -this.dir.y);
      if (cam.up.lengthSq() < 1e-8) cam.up.set(0, 0, 1).addScaledVector(this.dir, -this.dir.z);
    }
    cam.up.normalize();

    let yaw = this.pendingYaw;
    let pitch = this.pendingPitch;
    if (this.enableDamping) {
      yaw *= this.dampingFactor;
      pitch *= this.dampingFactor;
      this.pendingYaw -= yaw;
      this.pendingPitch -= pitch;
    } else {
      this.pendingYaw = 0;
      this.pendingPitch = 0;
    }

    if (this.autoRotate) {
      // Same angular speed as OrbitControls: 2π/60 * speed per second
      yaw -= ((2 * Math.PI) / 60) * this.autoRotateSpeed * dtSec;
    }

    // Yaw: spin around the camera's up axis (screen-vertical)
    if (Math.abs(yaw) > 1e-9) {
      this.offset.applyAxisAngle(cam.up, yaw);
    }

    // Pitch: tilt around the camera's right axis — no clamp, so it goes over the poles
    if (Math.abs(pitch) > 1e-9) {
      this.dir.copy(this.offset).normalize();
      this.right.crossVectors(cam.up, this.dir).normalize();
      this.offset.applyAxisAngle(this.right, pitch);
      cam.up.applyAxisAngle(this.right, pitch);
    }

    len = Math.min(this.maxDistance, Math.max(this.minDistance, this.offset.length()));
    this.offset.setLength(len);

    cam.position.copy(this.target).add(this.offset);
    cam.lookAt(this.target);
  }

  /* ------------------------------- input -------------------------------- */

  private rotateBy(dx: number, dy: number) {
    const h = Math.max(1, this.dom.clientHeight);
    const k = (2 * Math.PI * this.rotateSpeed) / h;
    // Drag right => scene follows right (camera yaws left); drag down => scene follows down
    this.pendingYaw += -dx * k;
    this.pendingPitch += -dy * k;
  }

  private zoomBy(scale: number) {
    this.offset.copy(this.camera.position).sub(this.target).multiplyScalar(scale);
    const len = Math.min(this.maxDistance, Math.max(this.minDistance, this.offset.length()));
    this.offset.setLength(len);
    this.camera.position.copy(this.target).add(this.offset);
  }

  private pinchDistance() {
    const pts = [...this.pointers.values()];
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.dom.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) this.pinchDist = this.pinchDistance();
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p || !this.enabled) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;

    if (this.pointers.size === 1) {
      this.rotateBy(dx, dy);
    } else if (this.pointers.size === 2) {
      const d = this.pinchDistance();
      if (this.pinchDist > 0 && d > 0) this.zoomBy(this.pinchDist / d);
      this.pinchDist = d;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.dom.hasPointerCapture?.(e.pointerId)) this.dom.releasePointerCapture(e.pointerId);
    if (this.pointers.size === 2) this.pinchDist = this.pinchDistance();
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const s = Math.pow(0.95, this.zoomSpeed * Math.abs(delta * 0.01));
    this.zoomBy(delta < 0 ? s : 1 / s);
  };

  private onContextMenu = (e: Event) => {
    e.preventDefault();
  };
}
