import * as THREE from 'three';
import { FreeOrbitControls } from './FreeOrbitControls';
import { SURAHS_LIST } from '../../data/surahs';
import { getSurahMindMap } from '../../data/mindmaps/mindmapData';
import { soundEffects } from '../../services/soundEffects';
import { fetchSurahAllAyahs, getCachedAyah } from '../../services/quranApi';
import type { MindMapNode, SurahMeta, SurahMindMap } from '../../types';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type GlobeLevel = 'surahs' | 'sections' | 'ayat';
export type RevelationFilter = 'all' | 'Meccan' | 'Medinan';
export type GlobeMode =
  | 'globe'
  | 'entering'
  | 'surah'
  | 'leaving'
  | 'section'
  | 'entering_section'
  | 'leaving_section';

export interface SurahHoverItem {
  kind: 'ayah' | 'branch' | 'child' | 'center' | 'surah';
  surahNumber: number;
  title: string;
  subtitle?: string;
  ayahText?: string;
  color: string;
  ayah?: number;
}

export interface GlobeCallbacks {
  onHoverSurah: (surahNumber: number | null) => void;
  onHoverItem: (item: SurahHoverItem | null) => void;
  onModeChange: (mode: GlobeMode, surahNumber: number | null, branchIndex?: number | null) => void;
  onClickAyah: (surahNumber: number, ayah: number) => void;
  /** Fired instead of entering a surah while pick mode is on (compare / listen tools). */
  onPickSurah?: (surahNumber: number) => void;
}

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const SHELL_R = 100;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const MECCAN_COLOR = '#f5b942';
const MEDINAN_COLOR = '#34d3b5';
const DIM = 0.12;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const ZERO = new THREE.Vector3();
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Strip the "(آيات 1-5)" suffixes from branch titles so labels stay short. */
export function shortTitle(t: string): string {
  const s = t.replace(/\s*[(（][^)）]*[)）]/g, '').trim();
  return s.length > 0 ? s : t;
}

/** Evenly distributed direction on a unit sphere (Fibonacci lattice). */
function fibPoint(i: number, n: number): THREE.Vector3 {
  const y = 1 - (2 * (i + 0.5)) / Math.max(1, n);
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const th = i * GOLDEN;
  return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
}

/**
 * Places `n` points at equal arc-length along a spiral ("coil") that winds from the
 * north pole to the south pole. Surah 1 is at the top, surah 114 at the bottom, so the
 * thread through them follows the order of the mushaf.
 */
function coilLayout(n: number, turns: number) {
  const c = 2 * turns;
  const phiTop = Math.PI / 2 - 0.1;
  const phiBottom = -Math.PI / 2 + 0.1;
  const S = 4000;
  const phis: number[] = [];
  const cum: number[] = [0];
  for (let j = 0; j <= S; j++) {
    const phi = phiTop + ((phiBottom - phiTop) * j) / S;
    phis.push(phi);
    if (j > 0) {
      const mid = (phis[j] + phis[j - 1]) / 2;
      const dphi = Math.abs(phis[j] - phis[j - 1]);
      cum.push(cum[j - 1] + Math.sqrt(1 + c * c * Math.cos(mid) * Math.cos(mid)) * dphi);
    }
  }
  const total = cum[S];
  const toVec = (phi: number) => {
    const theta = c * (phiTop - phi);
    return new THREE.Vector3(
      SHELL_R * Math.cos(phi) * Math.cos(theta),
      SHELL_R * Math.sin(phi),
      SHELL_R * Math.cos(phi) * Math.sin(theta)
    );
  };
  const points: THREE.Vector3[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = ((i + 0.5) / n) * total;
    while (j < S && cum[j + 1] < target) j++;
    const f = (target - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]);
    points.push(toVec(phis[j] + (phis[j + 1] - phis[j]) * f));
  }
  const curve: THREE.Vector3[] = [];
  for (let k = 0; k <= S; k += 8) curve.push(toVec(phis[k]));
  return { points, curve };
}

function tangentBasis(n: THREE.Vector3) {
  const helper = Math.abs(n.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(helper, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return { u, v };
}

const rangeDist = (r: { start: number; end: number }, a: number) =>
  a < r.start ? r.start - a : a > r.end ? a - r.end : 0;

interface AyahRes {
  branch: number;
  color: string;
  title: string;
  sub?: string;
}

/** Maps every ayah of a surah to the mind-map branch (and child) that covers it. */
export function resolveAyahs(map: SurahMindMap): AyahRes[] {
  const total = map.totalVerses;
  const out: AyahRes[] = [];
  for (let a = 1; a <= total; a++) {
    let bi = -1;
    let best = Infinity;
    map.branches.forEach((b, i) => {
      if (!b.ayahRange) return;
      const d = rangeDist(b.ayahRange, a);
      if (d < best) {
        best = d;
        bi = i;
      }
    });
    if (bi < 0) bi = Math.min(map.branches.length - 1, Math.floor(((a - 1) / total) * map.branches.length));
    const b = map.branches[bi];
    let color = b.color || '#3B82F6';
    let sub: string | undefined;
    const child = b.children?.find((c) => c.ayahRange && a >= c.ayahRange.start && a <= c.ayahRange.end);
    if (child) {
      color = child.color || color;
      sub = shortTitle(child.title);
    }
    out.push({ branch: bi, color, title: shortTitle(b.title), sub });
  }
  return out;
}

/** Thin soft ring, white so it can be tinted via SpriteMaterial.color. */
function makeRingTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.8, 'rgba(255,255,255,0)');
  grd.addColorStop(0.9, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.97, 'rgba(255,255,255,0.25)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Seeded pseudo-random helper (xorshift32) */
function seededRand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 0xffffffff);
  };
}

/**
 * Procedural planet surface texture.
 * isMeccan → warm desert palette  (sand/ochre/rust)
 * Medinan  → cool ocean palette   (teal/blue/green)
 */
function makePlanetTexture(isMeccan: boolean, seed: number): THREE.CanvasTexture {
  const SIZE = 256;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const rng = seededRand(seed * 7919);

  // Base ocean / desert background
  const base = isMeccan ? '#c47a2a' : '#1a4a6b';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Land blobs
  const landColors = isMeccan
    ? ['#e8a44a', '#d4882e', '#f0c070', '#a85c1a', '#c8762a', '#f5d080']
    : ['#2a7a4a', '#1e6655', '#3a8a5a', '#4a9a6a', '#5aaa7a', '#2a5a8a'];

  const blobCount = 18 + Math.floor(rng() * 12);
  for (let i = 0; i < blobCount; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    const rx = 8 + rng() * 50;
    const ry = 6 + rng() * 40;
    const angle = rng() * Math.PI * 2;
    const col = landColors[Math.floor(rng() * landColors.length)];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
    grd.addColorStop(0, col + 'ff');
    grd.addColorStop(0.6, col + 'cc');
    grd.addColorStop(1, col + '00');
    ctx.fillStyle = grd;
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Polar ice caps
  const iceAlpha = 0.55 + rng() * 0.3;
  const iceSize = 20 + rng() * 20;
  for (const py of [0, SIZE]) {
    const grd = ctx.createRadialGradient(SIZE / 2, py, 0, SIZE / 2, py, iceSize);
    grd.addColorStop(0, `rgba(230,245,255,${iceAlpha})`);
    grd.addColorStop(1, 'rgba(230,245,255,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  // Subtle vignette
  const vig = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.25, SIZE / 2, SIZE / 2, SIZE * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Semi-transparent white cloud layer texture */
function makeCloudTexture(seed: number): THREE.CanvasTexture {
  const SIZE = 256;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;
  const rng = seededRand(seed * 3571);

  ctx.clearRect(0, 0, SIZE, SIZE);

  const bands = 6 + Math.floor(rng() * 4);
  for (let b = 0; b < bands; b++) {
    const y = rng() * SIZE;
    const w = 60 + rng() * 120;
    const h = 8 + rng() * 22;
    const alpha = 0.25 + rng() * 0.45;
    const puffs = 3 + Math.floor(rng() * 6);
    for (let p = 0; p < puffs; p++) {
      const px = (rng() * SIZE * 2 - SIZE * 0.5 + w * p / puffs) % SIZE;
      const grd = ctx.createRadialGradient(px, y, 0, px, y, w / puffs);
      grd.addColorStop(0, `rgba(255,255,255,${alpha})`);
      grd.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.6})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;
      ctx.save();
      ctx.scale(1, h / (w / puffs));
      ctx.beginPath();
      ctx.arc(px, y / (h / (w / puffs)), w / puffs, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Sun-like animated texture for the core star */
function makeSunTexture(): THREE.CanvasTexture {
  const SIZE = 256;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d')!;

  // Deep core
  const base = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  base.addColorStop(0, '#fff8d0');
  base.addColorStop(0.3, '#ffd060');
  base.addColorStop(0.65, '#ff8c10');
  base.addColorStop(1, '#cc4400');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Solar granulation blobs
  const rng = seededRand(42);
  for (let i = 0; i < 60; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    const r = 4 + rng() * 18;
    const bright = rng() > 0.5;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, bright ? 'rgba(255,240,140,0.5)' : 'rgba(120,40,0,0.4)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return new THREE.CanvasTexture(c);
}


/* ------------------------------------------------------------------ */
/* Internal types                                                      */
/* ------------------------------------------------------------------ */

interface LabelItem {
  el: HTMLDivElement;
  pos: THREE.Vector3;
  kind: 'globe' | 'hover' | 'surah' | 'section';
  parent?: THREE.Object3D;
  node?: SurahNode;
  offsetY: number;
}

interface SurahNode {
  index: number;
  meta: SurahMeta;
  map: SurahMindMap;
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  radius: number;
  color: THREE.Color;
  mesh: THREE.Mesh;
  cloudMesh: THREE.Mesh; // rotating cloud shell
  cloudSpeed: number;    // rotation speed (radians/s)
  glow: THREE.Sprite;
  label: LabelItem;
  dim: number;
  scale: number;
  u: THREE.Vector3;
  v: THREE.Vector3;
  revealTime: number; // seconds after start when this node begins fading in
}

interface FadeItem {
  mat: THREE.Material;
  base: number;
  group: 'core' | 'sections' | 'ayat';
}

interface Pickable {
  kind: SurahHoverItem['kind'];
  local: THREE.Vector3;
  r: number;
  ayah?: number;
  branchIndex?: number;
  info: SurahHoverItem;
  mesh?: THREE.Mesh;
  glow?: THREE.Sprite;
  label?: LabelItem;
  baseScale?: number;
}

interface SurahScene {
  group: THREE.Group;
  node: SurahNode;
  extent: number;
  pickables: Pickable[];
  ayahMesh: THREE.InstancedMesh;
  ayahBase: THREE.Vector3[];
  branchPos: THREE.Vector3[];
  viewDir: THREE.Vector3;
  res: AyahRes[];
}

interface SectionScene {
  group: THREE.Group;
  node: SurahNode;
  branchIndex: number;
  branch: MindMapNode;
  startAyah: number;
  endAyah: number;
  count: number;
  pickables: Pickable[];
  radius: number;
}

interface Anim {
  t: number;
  dur: number;
  update: (k: number) => void;
  done?: () => void;
}

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

export class GlobeEngine {
  private container: HTMLElement;
  private cb: GlobeCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: FreeOrbitControls;
  private labelLayer: HTMLDivElement;
  private clock = new THREE.Clock();
  private raf = 0;
  private width = 1;
  private height = 1;
  private ro: ResizeObserver;

  private glowTex = makeGlowTexture();
  private ringTex = makeRingTexture();
  private sphereGeo = new THREE.SphereGeometry(1, 20, 20);

  private globeGroup = new THREE.Group();
  private coreGroup = new THREE.Group();
  private sectionsGroup = new THREE.Group();
  private hoverGroup = new THREE.Group();

  private nodes: SurahNode[] = [];
  private fadeItems: FadeItem[] = [];
  private labels: LabelItem[] = [];

  private lvl = { core: 1, sections: 0, ayat: 0 };
  private lvlTarget = { core: 1, sections: 0, ayat: 0 };
  private level: GlobeLevel = 'surahs';
  private filter: RevelationFilter = 'all';

  private satMesh?: THREE.InstancedMesh;
  private satBase: THREE.Color[] = [];
  private satOwner: number[] = [];
  private ayatPoints?: THREE.Points;
  private ayatBase?: Float32Array;
  private ayatOwner?: Uint16Array;

  private globeFade = 1;
  private mode: GlobeMode = 'globe';
  private anim: Anim | null = null;
  private defaultDist = 330;
  /** Guided tour: view the whole globe from far away so the screen panels do not cover it. */
  private overview = false;

  private mouse = { x: -9999, y: -9999, inside: false };
  private dragging = false;
  private downX = 0;
  private downY = 0;
  private downT = 0;

  private hoverNode: SurahNode | null = null;
  /** Surah whose hover card is held open by the guided tour (overrides the mouse). */
  private pinnedNode: SurahNode | null = null;
  private hoverStart = 0;
  private hoverSatellites: Pickable[] = [];
  private hoverSatellite: Pickable | null = null;

  private current: SurahScene | null = null;
  private sectionScene: SectionScene | null = null;
  private hoverPick: Pickable | null = null;

  private lastCamAngle = 0;
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private disposed = false;

  // listening mode
  private listenNode: SurahNode | null = null;
  private listenSurah: number | null = null;
  private listenAyah: number = 1;
  private listenPlaying = false;
  private listenPulse = 0;
  private ripples: { sprite: THREE.Sprite; age: number }[] = [];
  private followCamera = true;

  // pick / compare
  private pickMode = false;
  private compareNodes: (SurahNode | null)[] = [null, null];
  private compareRings: THREE.Sprite[] = [];
  private compareArc: THREE.Line | null = null;
  private compareDot: THREE.Sprite | null = null;
  private compareCurve: THREE.Vector3[] = [];

  constructor(container: HTMLElement, callbacks: GlobeCallbacks) {
    this.container = container;
    this.cb = callbacks;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    this.labelLayer = document.createElement('div');
    this.labelLayer.style.cssText =
      'position:absolute;inset:0;overflow:hidden;pointer-events:none;';
    container.appendChild(this.labelLayer);

    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 4000);
    this.controls = new FreeOrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 0.8;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.45;

    this.scene.add(this.globeGroup, this.hoverGroup);
    this.globeGroup.add(this.coreGroup, this.sectionsGroup);

    this.buildStars();
    this.buildCore();
    this.buildNodes();
    this.buildSatellites();

    this.handleResize();
    const aspectBoost = this.width / this.height < 1 ? Math.min(2.2, (1 / (this.width / this.height)) * 0.9) : 1;
    this.defaultDist = 330 * aspectBoost;
    this.applyGlobeLimits();
    this.camera.position.set(0, this.defaultDist * 0.2, this.defaultDist);
    this.controls.update();

    this.ro = new ResizeObserver(() => this.handleResize());
    this.ro.observe(container);
    const el = this.renderer.domElement;
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointerleave', this.onPointerLeave);
    el.addEventListener('wheel', this.onWheel, { passive: true });

    this.loop();
  }

  /* ----------------------------- public API ----------------------------- */

  setLevel(level: GlobeLevel) {
    this.level = level;
    if (level === 'ayat') this.ensureAyatPoints();
    this.lvlTarget.sections = level === 'sections' ? 1 : 0;
    this.lvlTarget.ayat = level === 'ayat' ? 1 : 0;
    if (this.hoverNode) {
      const node = this.hoverNode;
      this.clearHoverGroup();
      this.buildHoverGroup(node);
    }
  }

  setFilter(filter: RevelationFilter) {
    this.filter = filter;
    this.nodes.forEach((n) => {
      if (!this.allowed(n)) {
        if (this.hoverNode === n) this.setHoverNode(null);
      }
    });
    this.refreshColors();
  }

  enterSurah(surahNumber: number) {
    if (this.mode !== 'globe') return;
    const node = this.nodes[surahNumber - 1];
    if (!node) return;
    this.setHoverNode(null);
    this.mode = 'entering';
    soundEffects.playTransitionAir();
    this.cb.onModeChange('entering', surahNumber);

    const sc = this.buildSurahScene(node);
    this.current = sc;
    this.scene.add(sc.group);

    const camDist = sc.extent * 2.2;
    const from = this.camera.position.clone();
    const fromT = this.controls.target.clone();
    const toT = node.pos.clone();
    const toP = node.pos.clone().add(sc.viewDir.clone().multiplyScalar(camDist));

    this.controls.enabled = false;
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
    this.controls.autoRotate = false;

    this.startAnim(2.4, (k) => {
      this.camera.position.lerpVectors(from, toP, k);
      this.controls.target.lerpVectors(fromT, toT, k);
      this.globeFade = 1 - smooth(0.2, 0.85, k);
      sc.group.scale.setScalar(Math.max(0.001, smooth(0.3, 1, k)));
    }, () => {
      this.globeFade = 0;
      this.globeGroup.visible = false;
      this.mode = 'surah';
      this.controls.enabled = true;
      this.controls.minDistance = 10;
      this.controls.maxDistance = sc.extent * 5;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.35;
      this.cb.onModeChange('surah', surahNumber);
      this.updateListeningVisuals();
    });
  }

  leaveSurah() {
    if (this.mode !== 'surah' || !this.current) return;
    const sc = this.current;
    const node = sc.node;
    this.setHoverPickable(null);
    this.mode = 'leaving';
    soundEffects.playTransitionAir();
    this.cb.onModeChange('leaving', node.meta.number);
    this.globeGroup.visible = true;

    const from = this.camera.position.clone();
    const fromT = this.controls.target.clone();
    const toT = new THREE.Vector3();
    const backDist = this.overview ? this.overviewDist() : this.defaultDist;
    const toP = node.normal.clone().multiplyScalar(backDist);
    toP.y += backDist * 0.15;

    this.controls.enabled = false;
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
    this.controls.autoRotate = false;

    this.startAnim(2.0, (k) => {
      this.camera.position.lerpVectors(from, toP, k);
      this.controls.target.lerpVectors(fromT, toT, k);
      this.globeFade = smooth(0.15, 0.8, k);
      sc.group.scale.setScalar(Math.max(0.001, 1 - smooth(0, 0.7, k)));
    }, () => {
      this.globeFade = 1;
      this.disposeSurahScene();
      this.mode = 'globe';
      this.controls.enabled = true;
      this.applyGlobeLimits();
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.45;
      this.cb.onModeChange('globe', null);
    });
  }

  /* ---------------------- Section (Ayah Sphere) Mode ---------------------- */

  enterSection(branchIndex: number) {
    if ((this.mode !== 'surah' && this.mode !== 'section') || !this.current) return;
    const sc = this.current;
    const node = sc.node;
    const map = node.map;
    const branches = map.branches;
    const b = branches[branchIndex];
    if (!b) return;

    if (this.sectionScene) {
      this.disposeSectionScene();
    }

    this.mode = 'entering_section';
    this.cb.onModeChange('entering_section', node.meta.number, branchIndex);
    soundEffects.playTransitionAir();

    const sec = this.buildSectionScene(node, branchIndex);
    this.sectionScene = sec;
    this.scene.add(sec.group);

    const fromP = this.camera.position.clone();
    const fromT = this.controls.target.clone();
    const toT = node.pos.clone();
    const camDist = sec.radius * 2.25;
    const toP = node.pos.clone().add(new THREE.Vector3(0, camDist * 0.15, camDist));

    this.controls.enabled = false;
    this.controls.autoRotate = false;

    this.startAnim(1.2, (k) => {
      this.camera.position.lerpVectors(fromP, toP, k);
      this.controls.target.lerpVectors(fromT, toT, k);
      sc.group.scale.setScalar(Math.max(0.001, 1 - smooth(0, 0.8, k)));
      sec.group.scale.setScalar(Math.max(0.001, smooth(0.2, 1, k)));
    }, () => {
      sc.group.visible = false;
      sec.group.scale.setScalar(1);
      this.mode = 'section';
      this.controls.enabled = true;
      this.controls.minDistance = Math.max(15, sec.radius * 0.35);
      this.controls.maxDistance = sec.radius * 4.8;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.28;
      this.cb.onModeChange('section', node.meta.number, branchIndex);
      this.updateListeningVisuals();

      // If playing an ayah in this newly entered section, frame it immediately:
      if (this.listenSurah === node.meta.number && this.listenPlaying) {
        const p = sec.pickables.find((x) => x.kind === 'ayah' && x.ayah === this.listenAyah);
        if (p) {
          const ayahDir = p.local.clone().normalize();
          const frameCamDist = sec.radius * 1.95;
          const frameToP = node.pos.clone().add(ayahDir.multiplyScalar(frameCamDist));
          this.flyCamera(frameToP, node.pos.clone(), 0.9);
        }
      }
    });
  }

  leaveSection() {
    if (this.mode !== 'section' || !this.current || !this.sectionScene) return;
    const sc = this.current;
    const sec = this.sectionScene;
    const node = sc.node;

    this.mode = 'leaving_section';
    this.cb.onModeChange('leaving_section', node.meta.number);
    soundEffects.playTransitionAir();

    sc.group.visible = true;
    const fromP = this.camera.position.clone();
    const fromT = this.controls.target.clone();
    const toT = node.pos.clone();
    const camDist = sc.extent * 2.2;
    const toP = node.pos.clone().add(sc.viewDir.clone().multiplyScalar(camDist));

    this.controls.enabled = false;
    this.controls.autoRotate = false;

    this.startAnim(1.4, (k) => {
      this.camera.position.lerpVectors(fromP, toP, k);
      this.controls.target.lerpVectors(fromT, toT, k);
      sec.group.scale.setScalar(Math.max(0.001, 1 - smooth(0, 0.8, k)));
      sc.group.scale.setScalar(Math.max(0.001, smooth(0.2, 1, k)));
    }, () => {
      this.disposeSectionScene();
      sc.group.scale.setScalar(1);
      this.mode = 'surah';
      this.controls.enabled = true;
      this.controls.minDistance = 10;
      this.controls.maxDistance = sc.extent * 5;
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.35;
      this.cb.onModeChange('surah', node.meta.number);
    });
  }

  nextSection() {
    if (this.mode !== 'section' || !this.current || !this.sectionScene) return;
    const node = this.current.node;
    const nextIdx = (this.sectionScene.branchIndex + 1) % node.map.branches.length;
    this.enterSection(nextIdx);
  }

  prevSection() {
    if (this.mode !== 'section' || !this.current || !this.sectionScene) return;
    const node = this.current.node;
    const total = node.map.branches.length;
    const prevIdx = (this.sectionScene.branchIndex - 1 + total) % total;
    this.enterSection(prevIdx);
  }

  focusBranch(index: number) {
    this.enterSection(index);
  }

  resetSurahView() {
    if (this.mode === 'surah' && this.current) {
      const sc = this.current;
      const dir = this.camera.position.clone().sub(this.controls.target).normalize();
      const toP = sc.node.pos.clone().add(dir.multiplyScalar(sc.extent * 2.2));
      this.flyCamera(toP, sc.node.pos.clone(), 1.1);
    } else if (this.mode === 'section' && this.current && this.sectionScene) {
      const sec = this.sectionScene;
      const camDist = sec.radius * 2.2;
      const toP = this.current.node.pos.clone().add(new THREE.Vector3(0, camDist * 0.18, camDist));
      this.flyCamera(toP, this.current.node.pos.clone(), 1.1);
    }
  }

  getMode(): GlobeMode {
    return this.mode;
  }

  /**
   * Guided tour: hold a surah's hover card open without the mouse (null releases it).
   * `overview` pulls the camera far back to see the whole globe (outer globe only; remembered for when we return to it).
   */
  previewSurah(surahNumber: number | null, overview = false) {
    const changed = overview !== this.overview;
    this.overview = overview;
    this.pinnedNode = surahNumber ? this.nodes[surahNumber - 1] ?? null : null;
    if (!this.pinnedNode && this.mode === 'globe') this.setHoverNode(null);
    if (this.mode !== 'globe') return;
    const dist = overview ? this.overviewDist() : null;
    if (this.pinnedNode) {
      this.focusDirection(this.pinnedNode.normal, dist ?? 230, dist ?? 330, true);
    } else if (changed) {
      const target = dist ?? this.defaultDist;
      this.focusDirection(this.camera.position.clone(), target, target, true);
    }
  }

  private overviewDist() {
    return this.defaultDist * 1.75;
  }

  /* --------------------- listening / compare public API --------------------- */

  /** While on, clicking a surah on the globe calls `onPickSurah` instead of entering it. */
  setPickMode(on: boolean) {
    this.pickMode = on;
  }

  /** Enables or disables automatic camera tracking following the recited Ayah and Surah */
  setFollowCamera(enabled: boolean) {
    this.followCamera = enabled;
  }

  getFollowCamera(): boolean {
    return this.followCamera;
  }

  private findBranchForAyah(surahNumber: number, ayahNumber: number): number {
    const map = getSurahMindMap(surahNumber);
    const res = resolveAyahs(map);
    if (res && res[ayahNumber - 1]) {
      return res[ayahNumber - 1].branch;
    }
    return 0;
  }

  /** Mark which surah and ayah is being recited. Pass null to stop. Flies the camera when follow mode is on. */
  setListening(surah: number | null, playing: boolean, ayah: number = 1) {
    const node = surah ? this.nodes[surah - 1] ?? null : null;
    const surahChanged = node !== this.listenNode;
    const ayahChanged = ayah !== this.listenAyah;

    if (surahChanged && this.listenNode) {
      this.listenNode.label.el.style.color = 'rgba(241,245,249,0.92)';
    }
    this.listenNode = node;
    this.listenSurah = surah;
    this.listenAyah = ayah;
    this.listenPlaying = playing && !!node;

    if (surahChanged && node) {
      this.listenPulse = 1;
      this.spawnRipple();
      if (this.followCamera && surah !== null) {
        const targetBranch = this.findBranchForAyah(surah, ayah);
        this.navigateDeepToAyah(surah, targetBranch, ayah);
      }
    } else if (ayahChanged && playing) {
      this.listenPulse = 1;
      if (this.followCamera && !this.dragging && surah !== null) {
        if (this.mode === 'section' && this.sectionScene && this.sectionScene.node.meta.number === surah) {
          if (ayah >= this.sectionScene.startAyah && ayah <= this.sectionScene.endAyah) {
            // Same section constellation: smoothly swing camera to center and frame this active ayah
            const p = this.sectionScene.pickables.find((x) => x.kind === 'ayah' && x.ayah === ayah);
            if (p) {
              const secNode = this.sectionScene.node;
              const ayahDir = p.local.clone().normalize();
              const camDist = this.sectionScene.radius * 2.0;
              const toP = secNode.pos.clone().add(ayahDir.multiplyScalar(camDist));
              const toT = secNode.pos.clone();
              this.flyCamera(toP, toT, 0.9);
            }
          } else {
            // Ayah rolled over to the next section in this surah
            const targetBranch = this.findBranchForAyah(surah, ayah);
            this.enterSection(targetBranch);
          }
        } else if (this.mode === 'surah' && this.current && this.current.node.meta.number === surah) {
          const targetBranch = this.findBranchForAyah(surah, ayah);
          this.enterSection(targetBranch);
        } else if (this.mode === 'globe') {
          const targetBranch = this.findBranchForAyah(surah, ayah);
          this.navigateDeepToAyah(surah, targetBranch, ayah);
        }
      }
    }

    this.updateListeningVisuals();
  }

  /** Called once per recited ayah: a beat on the node, active mahawir/ayah illumination, plus ripples. */
  pulseListening() {
    this.listenPulse = 1;
    if (this.mode === 'globe') {
      this.spawnRipple();
    }
    this.updateListeningVisuals();
  }

  /** Deep animated camera navigation: flies from Globe -> Surah -> Mehwar -> Ayah with focal highlight */
  navigateDeepToAyah(surahNumber: number, branchIndex: number, ayahNumber: number, onComplete?: () => void) {
    const executeFinalStep = () => {
      if (this.sectionScene && this.sectionScene.node.meta.number === surahNumber && this.sectionScene.branchIndex === branchIndex) {
        const p = this.sectionScene.pickables.find((x) => x.kind === 'ayah' && x.ayah === ayahNumber);
        if (p) {
          const node = this.sectionScene.node;
          const ayahDir = p.local.clone().normalize();
          const camDist = this.sectionScene.radius * 1.85;
          const toP = node.pos.clone().add(ayahDir.multiplyScalar(camDist));
          const toT = node.pos.clone();
          this.flyCamera(toP, toT, 1.2);
          this.pulseListening();
          onComplete?.();
        } else {
          this.pulseListening();
          onComplete?.();
        }
      }
    };

    // Mid-transition inside this same surah (e.g. follow mode already started entering a section):
    // don't tear the scene down, wait for it to settle and then retry.
    const transitional = this.mode === 'entering' || this.mode === 'entering_section' || this.mode === 'leaving_section';
    if (transitional && this.current?.node.meta.number === surahNumber) {
      this.waitFor(
        () => this.mode === 'surah' || this.mode === 'section',
        () => this.navigateDeepToAyah(surahNumber, branchIndex, ayahNumber, onComplete)
      );
      return;
    }

    // If already in the exact section constellation
    if (this.mode === 'section' && this.sectionScene?.node.meta.number === surahNumber && this.sectionScene?.branchIndex === branchIndex) {
      executeFinalStep();
      return;
    }

    // If in the surah or section scene of the same surah
    if ((this.mode === 'surah' || this.mode === 'section') && this.current?.node.meta.number === surahNumber) {
      this.enterSection(branchIndex);
      return;
    }

    // If in another surah or section, clean up current and start from globe
    if (this.sectionScene) this.disposeSectionScene();
    if (this.current) this.disposeSurahScene();
    this.globeFade = 1;
    this.globeGroup.visible = true;
    this.mode = 'globe';
    this.cb.onModeChange('globe', null);

    const node = this.nodes[surahNumber - 1];
    if (!node) return;

    // Step 1: Smoothly rotate globe towards surah
    this.focusDirection(node.normal, 230, 330);

    // Step 2: Enter Surah, Step 3: Enter Section, Step 4: Frame the ayah.
    // Each step waits for the previous animation to really finish, so slow frame rates can't skip a step.
    setTimeout(() => {
      if (this.disposed) return;
      this.enterSurah(surahNumber);
      this.waitFor(
        () => this.mode === 'surah' && this.current?.node.meta.number === surahNumber,
        () => {
          this.enterSection(branchIndex);
          this.waitFor(
            () => this.mode === 'section' && this.sectionScene?.branchIndex === branchIndex,
            () => executeFinalStep()
          );
        }
      );
    }, 700);
  }

  /** Polls until `ready()` is true (or gives up), then runs `then`. Stops if the engine is disposed. */
  private waitFor(ready: () => boolean, then: () => void, maxMs = 15000) {
    const t0 = performance.now();
    const id = window.setInterval(() => {
      if (this.disposed) {
        window.clearInterval(id);
      } else if (ready()) {
        window.clearInterval(id);
        then();
      } else if (performance.now() - t0 > maxMs) {
        window.clearInterval(id);
      }
    }, 80);
  }

  private updateListeningVisuals() {
    if (this.mode === 'surah' || this.mode === 'entering') {
      this.updateSurahListeningVisuals();
    } else if (this.mode === 'section' || this.mode === 'entering_section') {
      this.updateSectionListeningVisuals();
    }
  }

  private updateSurahListeningVisuals() {
    const sc = this.current;
    if (!sc) return;
    const sn = sc.node.meta.number;
    const isListeningThisSurah = this.listenSurah === sn && this.listenPlaying;
    const activeAyah = isListeningThisSurah ? this.listenAyah : null;
    const activeBranch = (activeAyah && sc.res[activeAyah - 1]) ? sc.res[activeAyah - 1].branch : null;

    // 1. Highlight / pulse active branch and reset others
    for (const p of sc.pickables) {
      if (p.kind === 'branch' && p.branchIndex !== undefined) {
        const isAct = p.branchIndex === activeBranch;
        const bColor = sc.node.map.branches[p.branchIndex]?.color || '#3B82F6';
        if (p.mesh) {
          const baseS = 2.8;
          const targetS = isAct ? baseS * (1.4 + 0.3 * this.listenPulse) : baseS;
          p.mesh.scale.setScalar(targetS);
          (p.mesh.material as THREE.MeshBasicMaterial).color.set(isAct ? '#fde68a' : bColor);
        }
        if (p.glow) {
          const baseG = 22;
          const targetG = isAct ? baseG * (1.5 + 0.4 * this.listenPulse) : baseG;
          p.glow.scale.setScalar(targetG);
          (p.glow.material as THREE.SpriteMaterial).color.set(isAct ? '#f59e0b' : bColor);
          (p.glow.material as THREE.SpriteMaterial).opacity = isAct ? 1.0 : 0.8;
        }
        if (p.label?.el) {
          if (isAct) {
            p.label.el.style.border = '2px solid #fbbf24';
            p.label.el.style.boxShadow = '0 0 24px rgba(245, 158, 11, 0.85), 0 2px 10px rgba(0,0,0,0.7)';
            p.label.el.style.background = 'rgba(20, 24, 48, 0.96)';
            p.label.el.style.color = '#fde68a';
            p.label.el.style.transform = `scale(${1.12 + 0.06 * this.listenPulse})`;
            p.label.el.style.zIndex = '40';
          } else {
            p.label.el.style.border = `1px solid ${bColor}`;
            p.label.el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
            p.label.el.style.background = 'rgba(8,12,28,0.85)';
            p.label.el.style.color = '#fff';
            p.label.el.style.transform = 'scale(1)';
            p.label.el.style.zIndex = '1';
          }
        }
      }
    }

    // 2. Highlight active ayah dot inside ayahMesh
    const total = sc.node.map.totalVerses;
    const colorObj = new THREE.Color();
    for (let a = 1; a <= total; a++) {
      const isAct = a === activeAyah;
      const r = sc.res[a - 1];
      const p = sc.ayahBase[a - 1];
      const scale = isAct ? (2.2 + 0.7 * this.listenPulse) : 0.85;
      this.tmpM.compose(p, this.tmpQ.identity(), this.tmpB.setScalar(scale));
      sc.ayahMesh.setMatrixAt(a - 1, this.tmpM);
      colorObj.set(isAct ? '#fde68a' : r.color);
      sc.ayahMesh.setColorAt(a - 1, colorObj);
    }
    sc.ayahMesh.instanceMatrix.needsUpdate = true;
    if (sc.ayahMesh.instanceColor) sc.ayahMesh.instanceColor.needsUpdate = true;
  }

  private updateSectionListeningVisuals() {
    const sec = this.sectionScene;
    if (!sec) return;
    const sn = sec.node.meta.number;
    const isListeningThisSurah = this.listenSurah === sn && this.listenPlaying;
    const activeAyah = isListeningThisSurah ? this.listenAyah : null;
    const bColor = new THREE.Color(sec.branch.color || '#3B82F6');
    const dotRadius = Math.max(1.8, Math.min(3.2, sec.radius * 0.022));

    for (const p of sec.pickables) {
      if (p.kind === 'ayah' && p.ayah) {
        const isAct = p.ayah === activeAyah;
        if (p.mesh) {
          const s = isAct ? dotRadius * (2.4 + 0.6 * this.listenPulse) : dotRadius;
          p.mesh.scale.setScalar(s);
          (p.mesh.material as THREE.MeshBasicMaterial).color.set(isAct ? '#fef08a' : bColor);
        }
        if (p.glow) {
          const s = isAct ? dotRadius * (14 + 5 * this.listenPulse) : dotRadius * 7.5;
          p.glow.scale.setScalar(s);
          (p.glow.material as THREE.SpriteMaterial).color.set(isAct ? '#f59e0b' : bColor);
          (p.glow.material as THREE.SpriteMaterial).opacity = isAct ? 1.0 : 0.8;
        }
        if (p.label?.el) {
          if (isAct) {
            p.label.el.style.border = '2px solid #fbbf24';
            p.label.el.style.boxShadow = '0 0 28px rgba(245, 158, 11, 0.9), inset 0 0 12px rgba(245, 158, 11, 0.4)';
            p.label.el.style.background = 'rgba(18, 22, 48, 0.98)';
            p.label.el.style.transform = `scale(${1.14 + 0.06 * this.listenPulse})`;
            p.label.el.style.zIndex = '50';
            const badge = p.label.el.querySelector('span');
            if (badge) {
              badge.style.background = 'rgba(245, 158, 11, 0.45)';
              badge.style.borderColor = '#fbbf24';
              badge.style.color = '#fff';
              badge.style.fontWeight = '900';
            }
          } else {
            p.label.el.style.border = '1.5px solid ' + (sec.branch.color || '#3B82F6');
            p.label.el.style.boxShadow = '0 4px 14px rgba(0,0,0,0.6)';
            p.label.el.style.background = 'rgba(8,14,32,0.92)';
            p.label.el.style.transform = 'scale(1)';
            p.label.el.style.zIndex = '1';
            const badge = p.label.el.querySelector('span');
            if (badge) {
              badge.style.background = 'rgba(251,191,36,0.22)';
              badge.style.borderColor = 'rgba(251,191,36,0.6)';
              badge.style.color = '#fde68a';
              badge.style.fontWeight = '900';
            }
          }
        }
      }
    }
  }

  /** Highlight up to two surahs, join them with an arc and bring both into view. */
  setCompare(a: number | null, b: number | null) {
    const prev = this.compareNodes;
    const next = [a ? this.nodes[a - 1] ?? null : null, b ? this.nodes[b - 1] ?? null : null];
    this.compareNodes = next;

    const colors = ['#38bdf8', '#c084fc'];
    next.forEach((n, i) => {
      let ring = this.compareRings[i];
      if (!ring) {
        ring = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.ringTex,
            color: colors[i],
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: false,
            transparent: true,
          })
        );
        this.compareRings[i] = ring;
        this.globeGroup.add(ring);
      }
      ring.visible = !!n;
      if (n) ring.position.copy(n.pos);
    });

    this.clearCompareArc();
    if (next[0] && next[1]) {
      this.buildCompareArc(next[0], next[1]);
      const mid = next[0].normal.clone().add(next[1].normal);
      if (mid.lengthSq() > 0.05) this.focusDirection(mid.normalize(), 280, 400);
    } else {
      const only = next[0] || next[1];
      const changed = only && !prev.includes(only);
      if (only && changed) this.focusDirection(only.normal, 230, 330);
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('wheel', this.onWheel);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.glowTex.dispose();
    this.ringTex.dispose();
    this.sphereGeo.dispose();
    this.renderer.dispose();
    this.container.removeChild(el);
    this.container.removeChild(this.labelLayer);
  }

  /* ------------------------------ building ------------------------------ */

  private reg(mat: THREE.Material, base: number, group: FadeItem['group'] = 'core') {
    mat.transparent = true;
    this.fadeItems.push({ mat, base, group });
  }

  private makeLabel(
    text: string,
    kind: LabelItem['kind'],
    pos: THREE.Vector3,
    opts: { css?: string; offsetY?: number; parent?: THREE.Object3D; node?: SurahNode; html?: string } = {}
  ): LabelItem {
    const el = document.createElement('div');
    el.style.cssText =
      'position:absolute;left:0;top:0;white-space:nowrap;pointer-events:none;will-change:transform,opacity;' +
      "font-family:'Amiri', 'Cairo', serif, system-ui, sans-serif;opacity:0;transition:transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;" +
      (opts.css || '');
    if (opts.html) el.innerHTML = opts.html;
    else el.textContent = text;
    this.labelLayer.appendChild(el);
    const item: LabelItem = { el, pos, kind, parent: opts.parent, node: opts.node, offsetY: opts.offsetY ?? 0 };
    this.labels.push(item);
    return item;
  }

  private removeLabels(kind: LabelItem['kind']) {
    this.labels = this.labels.filter((l) => {
      if (l.kind === kind) {
        l.el.remove();
        return false;
      }
      return true;
    });
  }

  private buildStars() {
    const n = 1800;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(1100 + Math.random() * 900);
      arr.set([v.x, v.y, v.z], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xaecbff,
      size: 1.6,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });
    this.scene.add(new THREE.Points(geo, mat));
  }

  private buildCore() {
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    this.reg(coreMat, 0.95);
    const core = new THREE.Mesh(this.sphereGeo, coreMat);
    core.scale.setScalar(10);
    this.coreGroup.add(core);

    const glowMat = new THREE.SpriteMaterial({
      map: this.glowTex,
      color: 0xffb347,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.reg(glowMat, 0.85);
    const glow = new THREE.Sprite(glowMat);
    glow.scale.setScalar(95);
    this.coreGroup.add(glow);

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(24, 1)),
      new THREE.LineBasicMaterial({ color: 0xf5b942, depthWrite: false })
    );
    this.reg(wire.material as THREE.Material, 0.28);
    this.coreGroup.add(wire);

    const shell = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(SHELL_R * 0.97, 3)),
      new THREE.LineBasicMaterial({ color: 0x4f7bd8, depthWrite: false })
    );
    this.reg(shell.material as THREE.Material, 0.07);
    this.globeGroup.add(shell);

    for (let i = 0; i < 3; i++) {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 128; k++) {
        const a = (k / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * SHELL_R * 1.16, 0, Math.sin(a) * SHELL_R * 1.16));
      }
      const ring = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xf5b942, depthWrite: false })
      );
      this.reg(ring.material as THREE.Material, 0.18);
      ring.rotation.set(0.5 + i * 0.9, i * 1.1, i * 0.6);
      ring.userData.spin = 0.03 + i * 0.02;
      this.coreGroup.add(ring);
    }
  }

  private buildNodes() {
    const n = SURAHS_LIST.length;
    const { points, curve } = coilLayout(n, 9);

    SURAHS_LIST.forEach((meta, i) => {
      const map = getSurahMindMap(meta.number);
      const pos = points[i];
      const normal = pos.clone().normalize();
      const { u, v } = tangentBasis(normal);
      const radius = 1.3 + 0.17 * Math.sqrt(meta.totalVerses);
      const color = new THREE.Color(meta.revelationType === 'Meccan' ? MECCAN_COLOR : MEDINAN_COLOR);

      const mesh = new THREE.Mesh(
        this.sphereGeo,
        new THREE.MeshBasicMaterial({ color, transparent: true })
      );
      mesh.position.copy(pos);
      mesh.scale.setScalar(radius);

      const cloudMesh = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ visible: false }));
      cloudMesh.position.copy(pos);
      const cloudSpeed = 0;

      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        })
      );
      glow.position.copy(pos);
      glow.scale.setScalar(radius * 6);

      this.globeGroup.add(mesh, glow);

      const label = this.makeLabel(meta.name, 'globe', pos, {
        offsetY: radius * 2.2 + 4,
        css:
          'font-size:12px;font-weight:800;color:rgba(241,245,249,0.92);text-shadow:0 1px 4px #000,0 0 10px rgba(0,0,0,0.8);letter-spacing:0.2px;',
      });

      // Start invisible; revealTime staggers entry by revelationOrder (نزول)
      const revealDelay = (meta.revelationOrder - 1) * 0.022; // 22 ms apart → full 114 in ~2.5 s
      const node: SurahNode = {
        index: i, meta, map, pos, normal, radius, color,
        mesh, cloudMesh, cloudSpeed,
        glow, label,
        dim: 0, scale: 0, u, v,
        revealTime: revealDelay,
      };
      label.node = node;
      this.nodes.push(node);
    });

    const thread = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve),
      new THREE.LineBasicMaterial({ color: 0xf5b942, depthWrite: false })
    );
    this.reg(thread.material as THREE.Material, 0.42);
    this.globeGroup.add(thread);

    const seen = new Set<string>();
    const webPts: THREE.Vector3[] = [];
    this.nodes.forEach((a) => {
      const near = this.nodes
        .filter((b) => b !== a)
        .map((b) => ({ b, d: a.pos.distanceToSquared(b.pos) }))
        .sort((x, y) => x.d - y.d)
        .slice(0, 3);
      near.forEach(({ b }) => {
        const key = a.index < b.index ? `${a.index}-${b.index}` : `${b.index}-${a.index}`;
        if (seen.has(key)) return;
        seen.add(key);
        webPts.push(a.pos, b.pos);
      });
    });
    const web = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(webPts),
      new THREE.LineBasicMaterial({ color: 0x6f8fd8, depthWrite: false })
    );
    this.reg(web.material as THREE.Material, 0.2);
    this.globeGroup.add(web);
  }

  private satelliteOffsets(node: SurahNode, count: number, customRadius?: number): THREE.Vector3[] {
    const out: THREE.Vector3[] = [];
    const ringR = customRadius ?? (11 + Math.min(6, count * 0.45));
    const rot = node.index * 0.9;
    for (let k = 0; k < count; k++) {
      const a = rot + (k / count) * Math.PI * 2;
      out.push(
        node.normal.clone().multiplyScalar(6)
          .addScaledVector(node.u, Math.cos(a) * ringR)
          .addScaledVector(node.v, Math.sin(a) * ringR)
      );
    }
    return out;
  }

  private buildSatellites() {
    const total = this.nodes.reduce((s, n) => s + n.map.branches.length, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.reg(mat, 0.95, 'sections');
    const mesh = new THREE.InstancedMesh(this.sphereGeo, mat, total);
    const linePts: THREE.Vector3[] = [];
    let idx = 0;
    this.nodes.forEach((node) => {
      const offs = this.satelliteOffsets(node, node.map.branches.length);
      node.map.branches.forEach((b, k) => {
        const p = node.pos.clone().add(offs[k]);
        this.tmpM.compose(p, this.tmpQ.identity(), this.tmpA.setScalar(1.15));
        mesh.setMatrixAt(idx, this.tmpM);
        const c = new THREE.Color(b.color || '#3B82F6');
        this.satBase.push(c);
        this.satOwner.push(node.index);
        mesh.setColorAt(idx, c);
        linePts.push(node.pos, p);
        idx++;
      });
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.satMesh = mesh;
    this.sectionsGroup.add(mesh);

    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(linePts),
      new THREE.LineBasicMaterial({ color: 0xcbd5e1, depthWrite: false })
    );
    this.reg(lines.material as THREE.Material, 0.35, 'sections');
    this.sectionsGroup.add(lines);
  }

  private ensureAyatPoints() {
    if (this.ayatPoints) return;
    const total = this.nodes.reduce((s, n) => s + n.meta.totalVerses, 0);
    const pos = new Float32Array(total * 3);
    const base = new Float32Array(total * 3);
    const owner = new Uint16Array(total);
    let idx = 0;
    const tmp = new THREE.Color();
    this.nodes.forEach((node) => {
      const n = node.meta.totalVerses;
      const res = resolveAyahs(node.map);
      const clusterR = Math.min(11, 2.5 + 0.5 * Math.sqrt(n));
      for (let k = 0; k < n; k++) {
        const p = node.pos.clone().add(fibPoint(k, n).multiplyScalar(clusterR * Math.cbrt((k + 0.5) / n)));
        pos.set([p.x, p.y, p.z], idx * 3);
        tmp.set(res[k].color);
        base.set([tmp.r, tmp.g, tmp.b], idx * 3);
        owner[idx] = node.index;
        idx++;
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base), 3));
    const mat = new THREE.PointsMaterial({
      size: 3.2,
      sizeAttenuation: true,
      vertexColors: true,
      map: this.glowTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.reg(mat, 1, 'ayat');
    this.ayatPoints = new THREE.Points(geo, mat);
    this.ayatBase = base;
    this.ayatOwner = owner;
    this.globeGroup.add(this.ayatPoints);
    this.refreshColors();
  }

  private refreshColors() {
    this.nodes.forEach((n) => ((n as SurahNode & { dimTarget?: number }).dimTarget = this.allowed(n) ? 1 : DIM));
    if (this.satMesh) {
      const c = new THREE.Color();
      this.satBase.forEach((b, i) => {
        const f = this.allowed(this.nodes[this.satOwner[i]]) ? 1 : DIM;
        c.copy(b).multiplyScalar(f);
        this.satMesh!.setColorAt(i, c);
      });
      if (this.satMesh.instanceColor) this.satMesh.instanceColor.needsUpdate = true;
    }
    if (this.ayatPoints && this.ayatBase && this.ayatOwner) {
      const attr = this.ayatPoints.geometry.getAttribute('color') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < this.ayatOwner.length; i++) {
        const f = this.allowed(this.nodes[this.ayatOwner[i]]) ? 1 : DIM;
        arr[i * 3] = this.ayatBase[i * 3] * f;
        arr[i * 3 + 1] = this.ayatBase[i * 3 + 1] * f;
        arr[i * 3 + 2] = this.ayatBase[i * 3 + 2] * f;
      }
      attr.needsUpdate = true;
    }
  }

  private allowed(n: SurahNode) {
    return this.filter === 'all' || n.meta.revelationType === this.filter;
  }

  /* --------------------------- hover (globe) ---------------------------- */

  private setHoverNode(node: SurahNode | null) {
    if (this.hoverNode === node) return;
    if (this.hoverNode) {
      this.hoverNode.label.el.style.color = 'rgba(241,245,249,0.92)';
      this.hoverNode.label.el.style.transform = '';
      this.hoverNode.label.el.style.zIndex = '';
    }
    this.hoverNode = node;
    this.clearHoverGroup();
    if (node) {
      node.label.el.style.color = '#fde68a';
      node.label.el.style.zIndex = '15';
      this.buildHoverGroup(node);
      this.hoverStart = this.clock.elapsedTime;
      soundEffects.playHoverAir();
      fetchSurahAllAyahs(node.meta.number).catch(() => {});
    }
    this.cb.onHoverSurah(node ? node.meta.number : null);
    this.renderer.domElement.style.cursor = node ? 'pointer' : '';
  }

  private clearHoverGroup() {
    this.hoverSatellite = null;
    this.hoverSatellites = [];
    this.removeLabels('hover');
    for (const child of [...this.hoverGroup.children]) {
      this.hoverGroup.remove(child);
      const m = child as THREE.Mesh;
      if (m.geometry && m.geometry !== this.sphereGeo) m.geometry.dispose();
      const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    }
  }

  private buildHoverGroup(node: SurahNode) {
    this.hoverGroup.position.copy(node.pos);
    this.hoverGroup.scale.setScalar(0.001);
    this.hoverSatellites = [];

    const linePts: THREE.Vector3[] = [];
    const surahNum = node.meta.number;
    const totalVerses = node.meta.totalVerses;

    if (this.level === 'ayat') {
      const res = resolveAyahs(node.map);
      const selectedAyat: number[] = [];
      if (totalVerses <= 12) {
        for (let a = 1; a <= totalVerses; a++) selectedAyat.push(a);
      } else {
        selectedAyat.push(1);
        if (totalVerses >= 5) selectedAyat.push(2);
        node.map.branches.forEach((b) => {
          if (b.ayahRange) {
            if (!selectedAyat.includes(b.ayahRange.start)) selectedAyat.push(b.ayahRange.start);
            const mid = Math.floor((b.ayahRange.start + b.ayahRange.end) / 2);
            if (!selectedAyat.includes(mid) && mid !== b.ayahRange.start && mid !== b.ayahRange.end) {
              selectedAyat.push(mid);
            }
          }
        });
        if (!selectedAyat.includes(totalVerses)) selectedAyat.push(totalVerses);
        selectedAyat.sort((a, b) => a - b);
        if (selectedAyat.length > 12) {
          const step = (selectedAyat.length - 1) / 11;
          const trimmed: number[] = [];
          for (let i = 0; i < 12; i++) {
            trimmed.push(selectedAyat[Math.round(i * step)]);
          }
          selectedAyat.length = 0;
          selectedAyat.push(...Array.from(new Set(trimmed)).sort((a, b) => a - b));
        }
      }

      const count = selectedAyat.length;
      const ringRadius = 14 + Math.min(8, count * 0.6);
      const offs = this.satelliteOffsets(node, count, ringRadius);

      selectedAyat.forEach((a, k) => {
        const r = res[a - 1] || { color: '#f5b942', title: 'آية ' + a };
        const col = new THREE.Color(r.color || '#f5b942');
        const o = offs[k];

        const m = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: col }));
        m.position.copy(o);
        m.scale.setScalar(1.35);

        const g = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTex,
            color: col,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
          })
        );
        g.position.copy(o);
        g.scale.setScalar(9);

        this.hoverGroup.add(m, g);
        linePts.push(new THREE.Vector3(), o);

        const cached = getCachedAyah(surahNum, a);
        const ayahSnippet = cached?.textUthmani ? (cached.textUthmani.length > 28 ? cached.textUthmani.slice(0, 26) + '…' : cached.textUthmani) : '';

        const label = this.makeLabel('', 'hover', o, {
          parent: this.hoverGroup,
          offsetY: 7,
          css:
            `display:flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#fff;padding:2px 8px;border-radius:9999px;` +
            `background:rgba(8,14,32,0.85);border:1px solid ${r.color || '#f5b942'};` +
            `backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,0.5);transform-origin:center;`,
          html:
            `<span style="color:#fde68a;font-weight:900;">آية ${a}</span>` +
            (ayahSnippet ? `<span style="opacity:0.85;font-size:10px;font-weight:500;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ayahSnippet}</span>` : ''),
        });

        const pick: Pickable = {
          kind: 'ayah',
          local: o.clone(),
          r: 2.2,
          ayah: a,
          info: {
            kind: 'ayah',
            surahNumber: surahNum,
            ayah: a,
            title: `الآية ${a} (${node.meta.name})`,
            subtitle: r.sub ? `${r.title} — ${r.sub}` : r.title,
            ayahText: cached?.textUthmani,
            color: r.color || '#f5b942',
          },
          mesh: m,
          glow: g,
          label,
          baseScale: 1.35,
        };
        this.hoverSatellites.push(pick);
      });
    } else {
      const branches = node.map.branches;
      const count = branches.length;
      const offs = this.satelliteOffsets(node, count);

      offs.forEach((o, k) => {
        const b = branches[k];
        const col = new THREE.Color(b.color || '#3B82F6');
        const m = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: col }));
        m.position.copy(o);
        m.scale.setScalar(1.7);
        const g = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTex,
            color: col,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
          })
        );
        g.position.copy(o);
        g.scale.setScalar(12);
        this.hoverGroup.add(m, g);
        linePts.push(new THREE.Vector3(), o);

        const title = shortTitle(b.title);
        const label = this.makeLabel(title, 'hover', o, {
          parent: this.hoverGroup,
          offsetY: 9,
          css:
            `font-size:11px;font-weight:700;color:#fff;padding:3px 9px;border-radius:9999px;` +
            `background:rgba(8,12,28,0.82);border:1px solid ${b.color || '#3B82F6'};` +
            `backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,0.5);transform-origin:center;`,
        });

        const rng = b.ayahRange ? `الآيات ${b.ayahRange.start}–${b.ayahRange.end}` : undefined;
        const pick: Pickable = {
          kind: 'branch',
          local: o.clone(),
          r: 2.8,
          branchIndex: k,
          info: {
            kind: 'branch',
            surahNumber: surahNum,
            title,
            subtitle: [rng, b.description].filter(Boolean).join(' • '),
            color: '#' + col.getHexString(),
          },
          mesh: m,
          glow: g,
          label,
          baseScale: 1.7,
        };
        this.hoverSatellites.push(pick);
      });
    }

    const lines = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(linePts),
      new THREE.LineBasicMaterial({ color: node.color, transparent: true, opacity: 0.85 })
    );
    this.hoverGroup.add(lines);
  }

  private setHoverSatellite(p: Pickable | null) {
    if (this.hoverSatellite === p) return;
    if (this.hoverSatellite) {
      const prev = this.hoverSatellite;
      if (prev.mesh && prev.baseScale) prev.mesh.scale.setScalar(prev.baseScale);
      if (prev.glow) prev.glow.scale.setScalar(prev.baseScale! * 6);
      if (prev.label) {
        prev.label.el.style.transform = prev.label.el.style.transform.replace(/\s*scale\([^)]+\)/g, '');
        prev.label.el.style.borderColor = prev.info.color;
        prev.label.el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.5)';
        prev.label.el.style.zIndex = '10';
      }
    }
    this.hoverSatellite = p;
    if (p) {
      if (p.mesh && p.baseScale) p.mesh.scale.setScalar(p.baseScale * 1.85);
      if (p.glow) p.glow.scale.setScalar(p.baseScale! * 11);
      if (p.label) {
        p.label.el.style.borderColor = '#fbbf24';
        p.label.el.style.boxShadow = '0 0 16px rgba(251,191,36,0.6), 0 2px 10px rgba(0,0,0,0.8)';
        p.label.el.style.zIndex = '30';
      }
      soundEffects.playHoverAir();

      if (p.kind === 'ayah' && p.ayah) {
        const cached = getCachedAyah(p.info.surahNumber, p.ayah);
        if (cached?.textUthmani) p.info.ayahText = cached.textUthmani;
      }
      this.cb.onHoverItem(p.info);
    } else {
      this.cb.onHoverItem(null);
    }
  }

  /* ------------------------ hover (inside a surah or section) ---------------------- */

  private setHoverPickable(p: Pickable | null) {
    if (this.hoverPick === p) return;
    if (this.hoverPick?.kind === 'ayah' && this.mode === 'surah') {
      this.setAyahScale(this.hoverPick.ayah! - 1, 1);
    }
    if (this.hoverPick?.label && this.mode === 'section') {
      this.hoverPick.label.el.style.borderColor = this.hoverPick.info.color;
      this.hoverPick.label.el.style.boxShadow = '0 4px 14px rgba(0,0,0,0.6)';
      this.hoverPick.label.el.style.zIndex = '10';
      if (this.hoverPick.mesh) this.hoverPick.mesh.scale.setScalar(1.2);
    }

    this.hoverPick = p;

    if (p?.kind === 'ayah') {
      if (this.mode === 'surah') {
        this.setAyahScale(p.ayah! - 1, 2.5);
      } else if (this.mode === 'section' && p.label) {
        p.label.el.style.borderColor = '#fbbf24';
        p.label.el.style.boxShadow = '0 0 22px rgba(251,191,36,0.8), 0 4px 16px rgba(0,0,0,0.9)';
        p.label.el.style.zIndex = '100';
        if (p.mesh) p.mesh.scale.setScalar(2.2);
      }
      soundEffects.playHoverAir();
      const cached = getCachedAyah(p.info.surahNumber, p.ayah!);
      if (cached?.textUthmani) p.info.ayahText = cached.textUthmani;
    } else if (p) {
      soundEffects.playHoverAir();
    }

    this.cb.onHoverItem(p ? p.info : null);
    this.renderer.domElement.style.cursor = p ? 'pointer' : '';
  }

  private setAyahScale(idx: number, k: number) {
    const sc = this.current;
    if (!sc) return;
    const base = sc.ayahBase[idx];
    if (!base) return;
    this.tmpM.compose(base, this.tmpQ.identity(), this.tmpA.setScalar(0.85 * k));
    sc.ayahMesh.setMatrixAt(idx, this.tmpM);
    sc.ayahMesh.instanceMatrix.needsUpdate = true;
  }

  /* --------------------------- Surah Scene ------------------------------ */

  private buildSurahScene(node: SurahNode): SurahScene {
    const map = node.map;
    const total = map.totalVerses;
    const res = resolveAyahs(map);
    const bn = map.branches.length;
    const counts: number[] = new Array(bn).fill(0);
    res.forEach((r) => counts[r.branch]++);
    const maxCount = Math.max(1, ...counts);

    const clusterR = (m: number) => 3.5 + 1.15 * Math.sqrt(m);
    const Rb = 26 + Math.min(22, Math.sqrt(total) * 1.3);
    const extent = Rb + clusterR(maxCount) + 16;

    const group = new THREE.Group();
    group.position.copy(node.pos);
    group.scale.setScalar(0.001);

    const pickables: Pickable[] = [];
    const surahName = node.meta.name;
    const sn = node.meta.number;

    const centreColor = node.color;
    const centreMesh = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: centreColor }));
    centreMesh.scale.setScalar(6);
    const centreGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: centreColor,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    centreGlow.scale.setScalar(46);
    group.add(centreMesh, centreGlow);
    pickables.push({
      kind: 'center',
      local: new THREE.Vector3(),
      r: 6,
      info: {
        kind: 'center',
        surahNumber: sn,
        title: `سورة ${surahName}`,
        subtitle: map.centralTheme,
        color: '#' + centreColor.getHexString(),
      },
    });
    this.makeLabel('', 'surah', new THREE.Vector3(), {
      parent: group,
      offsetY: 18,
      css: 'text-align:center;',
      html:
        `<div style="font-size:22px;font-weight:900;color:#fde68a;text-shadow:0 2px 10px #000;">سورة ${surahName}</div>` +
        `<div style="font-size:12px;font-weight:600;color:#e2e8f0;max-width:260px;white-space:normal;margin:2px auto 0;text-shadow:0 1px 6px #000;">${map.centralTheme}</div>`,
    });

    const branchPos: THREE.Vector3[] = [];
    const edgePts: THREE.Vector3[] = [];
    const edgeCols: number[] = [];
    const pushEdge = (
      a: THREE.Vector3,
      b: THREE.Vector3,
      ca: THREE.Color,
      cb: THREE.Color,
      store: { p: THREE.Vector3[]; c: number[] }
    ) => {
      store.p.push(a, b);
      store.c.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
    };
    const main = { p: edgePts, c: edgeCols };
    const spokes = { p: [] as THREE.Vector3[], c: [] as number[] };
    const thread = { p: [] as THREE.Vector3[], c: [] as number[] };
    const ring = { p: [] as THREE.Vector3[], c: [] as number[] };

    map.branches.forEach((b, bi) => {
      const col = new THREE.Color(b.color || '#3B82F6');
      const bp = fibPoint(bi, bn).multiplyScalar(Rb);
      branchPos.push(bp);

      const m = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: col }));
      m.position.copy(bp);
      m.scale.setScalar(2.8);
      const g = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: col,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        })
      );
      g.position.copy(bp);
      g.scale.setScalar(22);
      group.add(m, g);
      pushEdge(new THREE.Vector3(), bp, centreColor, col, main);

      const title = shortTitle(b.title);
      const rng = b.ayahRange ? `الآيات ${b.ayahRange.start}–${b.ayahRange.end}` : undefined;
      const branchLabel = this.makeLabel(title, 'surah', bp, {
        parent: group,
        offsetY: 12,
        css:
          `font-size:12px;font-weight:700;color:#fff;padding:3px 10px;border-radius:9999px;` +
          `background:rgba(8,12,28,0.85);border:1px solid ${b.color || '#3B82F6'};box-shadow:0 2px 8px rgba(0,0,0,0.5);transition:all 0.3s ease;`,
      });
      pickables.push({
        kind: 'branch',
        local: bp.clone(),
        r: 3.5,
        branchIndex: bi,
        mesh: m,
        glow: g,
        label: branchLabel,
        info: {
          kind: 'branch',
          surahNumber: sn,
          title,
          subtitle: [rng, b.description].filter(Boolean).join(' • '),
          color: '#' + col.getHexString(),
        },
      });

      const kids = b.children || [];
      const childR = clusterR(counts[bi]) + 6;
      kids.forEach((ch, ci) => {
        const cc = new THREE.Color(ch.color || b.color || '#3B82F6');
        const cp = bp.clone().add(fibPoint(ci, Math.max(kids.length, 2)).multiplyScalar(childR));
        const cm = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: cc }));
        cm.position.copy(cp);
        cm.scale.setScalar(1.3);
        group.add(cm);
        pushEdge(bp, cp, col, cc, spokes);
        pickables.push({
          kind: 'child',
          local: cp.clone(),
          r: 1.6,
          branchIndex: bi,
          info: {
            kind: 'child',
            surahNumber: sn,
            title: shortTitle(ch.title),
            subtitle: [ch.ayahRange ? `الآيات ${ch.ayahRange.start}–${ch.ayahRange.end}` : '', title].filter(Boolean).join(' • '),
            color: '#' + cc.getHexString(),
          },
        });
      });
    });

    if (bn > 2) {
      for (let i = 0; i < bn; i++) {
        const j = (i + 1) % bn;
        pushEdge(
          branchPos[i],
          branchPos[j],
          new THREE.Color(map.branches[i].color || '#3B82F6'),
          new THREE.Color(map.branches[j].color || '#3B82F6'),
          ring
        );
      }
    }

    const ayahMesh = new THREE.InstancedMesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), total);
    const ayahBase: THREE.Vector3[] = new Array(total);
    const perBranchSeen: number[] = new Array(bn).fill(0);
    const lastInBranch: (THREE.Vector3 | null)[] = new Array(bn).fill(null);
    const tmpC = new THREE.Color();
    for (let a = 1; a <= total; a++) {
      const r = res[a - 1];
      const bi = r.branch;
      const m = counts[bi];
      const k = perBranchSeen[bi]++;
      const rad = clusterR(m) * Math.cbrt((k + 0.5) / m);
      const p = branchPos[bi].clone().add(fibPoint(k, m).multiplyScalar(rad));
      ayahBase[a - 1] = p;
      this.tmpM.compose(p, this.tmpQ.identity(), this.tmpA.setScalar(0.85));
      ayahMesh.setMatrixAt(a - 1, this.tmpM);
      tmpC.set(r.color);
      ayahMesh.setColorAt(a - 1, tmpC);
      pushEdge(branchPos[bi], p, tmpC.clone(), tmpC.clone(), spokes);
      const prev = lastInBranch[bi];
      if (prev) pushEdge(prev, p, tmpC.clone(), tmpC.clone(), thread);
      lastInBranch[bi] = p;

      const cached = getCachedAyah(sn, a);
      pickables.push({
        kind: 'ayah',
        local: p.clone(),
        r: 1.1,
        ayah: a,
        info: {
          kind: 'ayah',
          surahNumber: sn,
          ayah: a,
          title: `الآية ${a}`,
          subtitle: r.sub ? `${r.title} — ${r.sub}` : r.title,
          ayahText: cached?.textUthmani,
          color: r.color,
        },
      });
    }
    ayahMesh.instanceMatrix.needsUpdate = true;
    if (ayahMesh.instanceColor) ayahMesh.instanceColor.needsUpdate = true;
    group.add(ayahMesh);

    const addLines = (store: { p: THREE.Vector3[]; c: number[] }, opacity: number) => {
      if (store.p.length === 0) return;
      const geo = new THREE.BufferGeometry().setFromPoints(store.p);
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(store.c), 3));
      group.add(
        new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false })
        )
      );
    };
    addLines(main, 0.75);
    addLines(ring, 0.25);
    addLines(spokes, 0.16);
    addLines(thread, 0.45);

    const branchDirs = branchPos.map((p) => p.clone().normalize());
    let viewDir = node.normal.clone();
    let bestScore = -Infinity;
    const CAND = 240;
    for (let i = 0; i < CAND; i++) {
      const d = fibPoint(i, CAND);
      let minAngle = Math.PI / 2;
      for (const b of branchDirs) minAngle = Math.min(minAngle, Math.acos(Math.min(1, Math.abs(d.dot(b)))));
      const score = minAngle + 0.15 * d.dot(node.normal);
      if (score > bestScore) {
        bestScore = score;
        viewDir = d;
      }
    }

    return { group, node, extent, pickables, ayahMesh, ayahBase, branchPos, viewDir, res };
  }

  private disposeSurahScene() {
    const sc = this.current;
    if (!sc) return;
    this.hoverPick = null;
    this.cb.onHoverItem(null);
    this.removeLabels('surah');
    this.scene.remove(sc.group);
    sc.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry !== this.sphereGeo) m.geometry.dispose();
      const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    sc.ayahMesh.dispose();
    this.current = null;
    this.renderer.domElement.style.cursor = '';
  }

  /* ------------------- Section Scene (Constellation Sphere) ------------------ */

  private buildSectionScene(node: SurahNode, branchIndex: number): SectionScene {
    const map = node.map;
    const b = map.branches[branchIndex] || map.branches[0];
    const sn = node.meta.number;
    const surahName = node.meta.name;

    const start = b.ayahRange?.start || 1;
    const end = b.ayahRange?.end || map.totalVerses;
    const count = end - start + 1;

    // Dynamically scale the 3D Constellation Sphere radius proportional to sqrt(count) and count
    // so surface area per verse is always spacious and non-overlapping, just like Surat Al-Fath!
    const radius = Math.max(48, 14.5 * Math.sqrt(count) + Math.min(60, count * 0.45));
    const dotRadius = Math.max(1.8, Math.min(3.2, radius * 0.022));

    const group = new THREE.Group();
    group.position.copy(node.pos);
    group.scale.setScalar(0.001);

    const pickables: Pickable[] = [];
    const bColor = new THREE.Color(b.color || '#3B82F6');

    // Central Theme Beacon
    const centerMesh = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: bColor }));
    centerMesh.scale.setScalar(Math.max(4.5, radius * 0.08));
    const centerGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: bColor,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    centerGlow.scale.setScalar(Math.max(38, radius * 0.48));
    group.add(centerMesh, centerGlow);

    const bTitle = shortTitle(b.title);
    this.makeLabel('', 'section', new THREE.Vector3(), {
      parent: group,
      offsetY: centerMesh.scale.x * 2.2 + 8,
      css: 'text-align:center;',
      html:
        `<div style="font-size:17px;font-weight:900;color:#fde68a;text-shadow:0 2px 10px #000;">${bTitle}</div>` +
        `<div style="font-size:11px;font-weight:700;color:#cbd5e1;margin-top:2px;background:rgba(8,14,32,0.8);padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,0.15);display:inline-block;">سورة ${surahName} · الآيات ${start}–${end} (${count} آية)</div>`,
    });

    pickables.push({
      kind: 'branch',
      local: new THREE.Vector3(),
      r: centerMesh.scale.x * 1.2,
      branchIndex,
      info: {
        kind: 'branch',
        surahNumber: sn,
        title: bTitle,
        subtitle: `الآيات ${start}–${end} · ${b.description || ''}`,
        color: '#' + bColor.getHexString(),
      },
    });

    // Wireframe cage around constellation
    const sphereWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(radius * 0.98, count > 40 ? 3 : 2)),
      new THREE.LineBasicMaterial({ color: bColor, transparent: true, opacity: 0.11, depthWrite: false })
    );
    group.add(sphereWire);

    // Arrange all Ayat across the sphere
    const seqPoints: THREE.Vector3[] = [];
    const seqColors: number[] = [];

    // Responsive card styling based on total count
    const cardMaxWidth = count > 50 ? '145px' : count > 25 ? '165px' : '190px';
    const cardPadding = count > 50 ? '4px 7px' : '5px 9px';
    const cardFontSize = count > 50 ? '11px' : '12px';

    for (let i = 0; i < count; i++) {
      const a = start + i;
      const p = fibPoint(i, count).multiplyScalar(radius);
      seqPoints.push(p);
      seqColors.push(bColor.r, bColor.g, bColor.b);

      const m = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: bColor }));
      m.position.copy(p);
      m.scale.setScalar(dotRadius);

      const g = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTex,
          color: bColor,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
        })
      );
      g.position.copy(p);
      g.scale.setScalar(dotRadius * 7.5);
      group.add(m, g);

      // Radial spoke connecting to center
      const spokeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), p]);
      const spoke = new THREE.Line(
        spokeGeo,
        new THREE.LineBasicMaterial({ color: bColor, transparent: true, opacity: 0.1, depthWrite: false })
      );
      group.add(spoke);

      const cached = getCachedAyah(sn, a);
      const fullText = cached?.textUthmani || '';
      const snippet = fullText ? (fullText.length > 50 ? fullText.slice(0, 48) + '…' : fullText) : `آية ${a}`;

      // Offset label cleanly above the glowing bead (dot) so the dot and connecting thread are clearly visible!
      const label = this.makeLabel('', 'section', p, {
        parent: group,
        offsetY: dotRadius * 2.2 + 8,
        css:
          `display:flex;flex-direction:column;gap:3px;background:rgba(8,14,32,0.92);border:1.5px solid ${b.color || '#3B82F6'};` +
          `border-radius:11px;padding:${cardPadding};backdrop-filter:blur(6px);box-shadow:0 4px 14px rgba(0,0,0,0.6);transform-origin:center;`,
        html:
          `<div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">` +
          `<span style="background:rgba(251,191,36,0.22);border:1px solid rgba(251,191,36,0.6);color:#fde68a;font-weight:900;padding:1px 5px;border-radius:6px;font-size:11px;">﴿ ${a} ﴾</span>` +
          `</div>` +
          `<div class="ayah-txt" style="font-size:${cardFontSize};font-weight:600;color:#f8fafc;line-height:1.42;max-width:${cardMaxWidth};white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-family:'Amiri', serif;">${snippet}</div>`,
      });

      pickables.push({
        kind: 'ayah',
        local: p.clone(),
        r: Math.max(3.0, dotRadius * 1.8),
        ayah: a,
        mesh: m,
        glow: g,
        label,
        info: {
          kind: 'ayah',
          surahNumber: sn,
          ayah: a,
          title: `سورة ${surahName} · الآية ${a}`,
          subtitle: bTitle,
          ayahText: fullText || undefined,
          color: b.color || '#3B82F6',
        },
      });
    }

    // Sequence thread connecting consecutive verses
    if (seqPoints.length > 1) {
      const threadGeo = new THREE.BufferGeometry().setFromPoints(seqPoints);
      threadGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(seqColors), 3));
      const thread = new THREE.Line(
        threadGeo,
        new THREE.LineBasicMaterial({ color: 0xf5b942, transparent: true, opacity: 0.65, depthWrite: false })
      );
      group.add(thread);
    }

    // Preload all ayahs in background and refresh text cards
    fetchSurahAllAyahs(sn).then((ayahs) => {
      pickables.forEach((p) => {
        if (p.kind === 'ayah' && p.ayah && p.label) {
          const item = ayahs.find((x) => x.numberInSurah === p.ayah);
          if (item?.textUthmani) {
            p.info.ayahText = item.textUthmani;
            const snip = item.textUthmani.length > 55 ? item.textUthmani.slice(0, 52) + '…' : item.textUthmani;
            const txtEl = p.label.el.querySelector<HTMLElement>('.ayah-txt');
            if (txtEl) {
              txtEl.textContent = snip;
              txtEl.dataset.exp = '0'; // text was reset to the snippet; let the frame loop re-expand if needed
            }
          }
        }
      });
    }).catch(() => {});

    return { group, node, branchIndex, branch: b, startAyah: start, endAyah: end, count, pickables, radius };
  }

  private disposeSectionScene() {
    const sec = this.sectionScene;
    if (!sec) return;
    this.hoverPick = null;
    this.cb.onHoverItem(null);
    this.removeLabels('section');
    this.scene.remove(sec.group);
    sec.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && m.geometry !== this.sphereGeo) m.geometry.dispose();
      const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else if (mat) mat.dispose();
    });
    this.sectionScene = null;
    this.renderer.domElement.style.cursor = '';
  }

  /* ------------------------------ animation ----------------------------- */

  private startAnim(dur: number, update: (k: number) => void, done?: () => void) {
    this.anim = { t: 0, dur, update, done };
  }

  private flyCamera(toP: THREE.Vector3, toT: THREE.Vector3, dur: number) {
    const from = this.camera.position.clone();
    const fromT = this.controls.target.clone();
    const prevMode = this.mode;
    soundEffects.playTransitionAir();
    const prevMin = this.controls.minDistance;
    const prevMax = this.controls.maxDistance;
    this.controls.minDistance = 0;
    this.controls.maxDistance = Infinity;
    this.controls.enabled = false;
    this.startAnim(dur, (k) => {
      this.camera.position.lerpVectors(from, toP, k);
      this.controls.target.lerpVectors(fromT, toT, k);
    }, () => {
      this.mode = prevMode;
      this.controls.enabled = true;
      this.controls.minDistance = prevMin;
      this.controls.maxDistance = prevMax;
    });
  }

  /** Smoothly swing the camera (great-circle) to look at the globe from `dir`, keeping a sensible zoom. */
  private focusDirection(dir: THREE.Vector3, minDist: number, maxDist: number, force = false) {
    if (this.mode !== 'globe' || (this.anim && !force) || this.dragging) return;
    const fromP = this.camera.position.clone();
    const fromDist = fromP.length();
    const toDist = Math.min(maxDist, Math.max(minDist, fromDist));
    const fromDir = fromP.clone().normalize();
    const toDir = dir.clone().normalize();
    if (fromDir.angleTo(toDir) < 0.05 && (!force || Math.abs(toDist - fromDist) < 1)) return;
    const q = new THREE.Quaternion().setFromUnitVectors(fromDir, toDir);
    const ident = new THREE.Quaternion();
    const cur = new THREE.Quaternion();
    const fromT = this.controls.target.clone();

    this.controls.enabled = false;
    this.startAnim(
      1.3,
      (k) => {
        cur.copy(ident).slerp(q, k);
        this.camera.position.copy(fromDir).applyQuaternion(cur).multiplyScalar(fromDist + (toDist - fromDist) * k);
        this.controls.target.lerpVectors(fromT, ZERO, k);
      },
      () => {
        this.controls.enabled = true;
      }
    );
  }

  private spawnRipple() {
    const n = this.listenNode;
    if (!n) return;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.ringTex,
        color: n.color,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        transparent: true,
        opacity: 0,
      })
    );
    sprite.position.copy(n.pos);
    sprite.scale.setScalar(n.radius * 2);
    this.globeGroup.add(sprite);
    this.ripples.push({ sprite, age: 0 });
    if (this.ripples.length > 8) this.removeRipple(this.ripples[0]);
  }

  private removeRipple(r: { sprite: THREE.Sprite; age: number }) {
    this.globeGroup.remove(r.sprite);
    (r.sprite.material as THREE.Material).dispose();
    this.ripples = this.ripples.filter((x) => x !== r);
  }

  private clearCompareArc() {
    if (this.compareArc) {
      this.globeGroup.remove(this.compareArc);
      this.compareArc.geometry.dispose();
      (this.compareArc.material as THREE.Material).dispose();
      this.compareArc = null;
    }
    if (this.compareDot) {
      this.globeGroup.remove(this.compareDot);
      (this.compareDot.material as THREE.Material).dispose();
      this.compareDot = null;
    }
    this.compareCurve = [];
  }

  private buildCompareArc(a: SurahNode, b: SurahNode) {
    const chord = a.pos.distanceTo(b.pos);
    const mid = a.pos.clone().add(b.pos).multiplyScalar(0.5);
    const lift = a.pos.length() + chord * 0.55;
    const ctrl = mid.lengthSq() > 1 ? mid.clone().normalize().multiplyScalar(lift) : a.normal.clone().multiplyScalar(lift);
    const pts = new THREE.QuadraticBezierCurve3(a.pos.clone(), ctrl, b.pos.clone()).getPoints(72);

    const c1 = new THREE.Color('#38bdf8');
    const c2 = new THREE.Color('#c084fc');
    const colors: number[] = [];
    pts.forEach((_, i) => {
      const c = c1.clone().lerp(c2, i / (pts.length - 1));
      colors.push(c.r, c.g, c.b);
    });
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.compareArc = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false })
    );
    this.globeGroup.add(this.compareArc);

    this.compareDot = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    this.compareDot.scale.setScalar(9);
    this.globeGroup.add(this.compareDot);
    this.compareCurve = pts;
  }

  private applyGlobeLimits() {
    this.controls.minDistance = 170;
    this.controls.maxDistance = Math.max(560, this.defaultDist * 2.4);
  }

  /* ------------------------------ interaction --------------------------- */

  private onWheel = (e: WheelEvent) => {
    soundEffects.playZoomAir(e.deltaY < 0 ? 'in' : 'out', Math.min(2, Math.abs(e.deltaY) / 80));
  };

  private onPointerMove = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
    this.mouse.inside = true;
  };

  private onPointerLeave = () => {
    this.mouse.inside = false;
    this.mouse.x = this.mouse.y = -9999;
  };

  private onPointerDown = (e: PointerEvent) => {
    this.onPointerMove(e);
    this.dragging = true;
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.downT = performance.now();
  };

  private onPointerUp = (e: PointerEvent) => {
    this.dragging = false;
    soundEffects.stopRotateAir();
    const moved = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
    if (moved < 6 && performance.now() - this.downT < 600) {
      this.onPointerMove(e);
      this.handleClick();
    }
  };

  private handleClick() {
    if (this.mode === 'globe') {
      this.updateHover();
      if (this.pickMode && this.cb.onPickSurah) {
        const picked = this.hoverSatellite?.info.surahNumber ?? this.hoverNode?.meta.number ?? null;
        if (picked) this.cb.onPickSurah(picked);
        return;
      }
      if (this.hoverSatellite) {
        if (this.hoverSatellite.kind === 'ayah' && this.hoverSatellite.ayah) {
          this.cb.onClickAyah(this.hoverSatellite.info.surahNumber, this.hoverSatellite.ayah);
        } else if (this.hoverSatellite.kind === 'branch') {
          this.enterSurah(this.hoverSatellite.info.surahNumber);
        }
      } else if (this.hoverNode) {
        this.enterSurah(this.hoverNode.meta.number);
      }
    } else if (this.mode === 'surah' && this.current) {
      this.updateHover();
      const p = this.hoverPick;
      if (!p) return;
      if (p.kind === 'ayah') {
        this.cb.onClickAyah(p.info.surahNumber, p.ayah!);
      } else if (p.kind === 'branch' || p.kind === 'child') {
        this.enterSection(p.branchIndex!);
      } else if (p.kind === 'center') {
        this.resetSurahView();
      }
    } else if (this.mode === 'section' && this.sectionScene) {
      this.updateHover();
      const p = this.hoverPick;
      if (!p) return;
      if (p.kind === 'ayah') {
        this.cb.onClickAyah(p.info.surahNumber, p.ayah!);
      } else if (p.kind === 'branch') {
        this.resetSurahView();
      }
    }
  }

  private projectedRadius(r: number, dist: number) {
    return (r * (this.height / 2)) / (Math.tan((this.camera.fov * Math.PI) / 360) * dist);
  }

  private updateHover() {
    if (this.mode === 'globe') {
      if (this.hoverNode && this.hoverSatellites.length > 0) {
        let bestSat: Pickable | null = null;
        let bestSatScore = Infinity;
        const s = this.hoverGroup.scale.x;

        for (const sat of this.hoverSatellites) {
          const w = this.tmpB.copy(sat.local).multiplyScalar(s).add(this.hoverGroup.position);
          const dist = this.camera.position.distanceTo(w);
          w.project(this.camera);
          if (w.z > 1) continue;
          const sx = (w.x * 0.5 + 0.5) * this.width;
          const sy = (-w.y * 0.5 + 0.5) * this.height;
          const d = Math.hypot(sx - this.mouse.x, sy - this.mouse.y);
          const pr = this.projectedRadius(sat.r, dist);
          const thr = Math.max(16, pr + 12);
          const score = d - pr;
          if (d < thr && score < bestSatScore) {
            bestSat = sat;
            bestSatScore = score;
          }
        }

        if (bestSat) {
          this.setHoverSatellite(bestSat);
          this.renderer.domElement.style.cursor = 'pointer';
          return;
        } else {
          this.setHoverSatellite(null);
        }

        const camDir = this.tmpA.copy(this.camera.position).normalize();
        if (this.hoverNode.normal.dot(camDir) > 0.05) {
          const v = this.tmpB.copy(this.hoverNode.pos).project(this.camera);
          const sx = (v.x * 0.5 + 0.5) * this.width;
          const sy = (-v.y * 0.5 + 0.5) * this.height;
          const d = Math.hypot(sx - this.mouse.x, sy - this.mouse.y);
          const clusterRadius = this.level === 'ayat' ? 85 : 70;
          if (d < clusterRadius) {
            return;
          }
        }
      }

      let best: SurahNode | null = null;
      let bestScore = Infinity;
      const camDir = this.tmpA.copy(this.camera.position).normalize();
      for (const n of this.nodes) {
        if (!this.allowed(n)) continue;
        if (n.normal.dot(camDir) < 0.05) continue;
        const v = this.tmpB.copy(n.pos).project(this.camera);
        const sx = (v.x * 0.5 + 0.5) * this.width;
        const sy = (-v.y * 0.5 + 0.5) * this.height;
        const d = Math.hypot(sx - this.mouse.x, sy - this.mouse.y);
        const pr = this.projectedRadius(n.radius, this.camera.position.distanceTo(n.pos));
        const thr = Math.max(18, pr * 1.5 + 12);
        if (d < thr && d < bestScore) {
          best = n;
          bestScore = d;
        }
      }
      this.setHoverNode(best);
    } else if (this.mode === 'surah' && this.current) {
      const sc = this.current;
      let best: Pickable | null = null;
      let bestScore = Infinity;
      const s = sc.group.scale.x;
      for (const p of sc.pickables) {
        const w = this.tmpB.copy(p.local).multiplyScalar(s).add(sc.group.position);
        const dist = this.camera.position.distanceTo(w);
        w.project(this.camera);
        if (w.z > 1) continue;
        const sx = (w.x * 0.5 + 0.5) * this.width;
        const sy = (-w.y * 0.5 + 0.5) * this.height;
        const d = Math.hypot(sx - this.mouse.x, sy - this.mouse.y);
        const pr = this.projectedRadius(p.r, dist);
        const thr = Math.max(14, pr + 8);
        const score = d - pr;
        if (d < thr && score < bestScore) {
          best = p;
          bestScore = score;
        }
      }
      this.setHoverPickable(best);
    } else if (this.mode === 'section' && this.sectionScene) {
      const sec = this.sectionScene;
      let best: Pickable | null = null;
      let bestScore = Infinity;
      const s = sec.group.scale.x;
      // Canvas origin in viewport coords — needed to convert label rects to canvas-relative
      const canvasRect = this.renderer.domElement.getBoundingClientRect();
      const mx = this.mouse.x; // canvas-relative
      const my = this.mouse.y;
      for (const p of sec.pickables) {
        const w = this.tmpB.copy(p.local).multiplyScalar(s).add(sec.group.position);
        const dist = this.camera.position.distanceTo(w);
        w.project(this.camera);
        if (w.z > 1) continue;
        const sx = (w.x * 0.5 + 0.5) * this.width;
        const sy = (-w.y * 0.5 + 0.5) * this.height;

        let hit = false;
        let score = Infinity;

        // For ayah cards: use the rendered label bounding rect as the hit area
        if (p.kind === 'ayah' && p.label && parseFloat(p.label.el.style.opacity || '0') > 0.05) {
          const lr = p.label.el.getBoundingClientRect();
          const lx0 = lr.left - canvasRect.left;
          const ly0 = lr.top  - canvasRect.top;
          const lx1 = lx0 + lr.width;
          const ly1 = ly0 + lr.height;
          // Expand hit zone by 6px on all sides for easier targeting
          if (mx >= lx0 - 6 && mx <= lx1 + 6 && my >= ly0 - 6 && my <= ly1 + 6) {
            hit = true;
            // Score by distance from label center so closest card wins when overlapping
            score = Math.hypot(mx - (lx0 + lr.width / 2), my - (ly0 + lr.height / 2));
          }
        }

        // Fallback: dot / branch sphere hit test (unchanged)
        if (!hit) {
          const d = Math.hypot(sx - mx, sy - my);
          const pr = this.projectedRadius(p.r, dist);
          const thr = Math.max(22, pr + 14);
          if (d < thr) {
            hit = true;
            score = d - pr;
          }
        }

        if (hit && score < bestScore) {
          best = p;
          bestScore = score;
        }
      }
      this.setHoverPickable(best);
    }
  }

  private handleResize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* -------------------------------- loop -------------------------------- */

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const now = this.clock.elapsedTime;

    const currentAngle = Math.atan2(this.camera.position.x, this.camera.position.z);
    const angleDiff = Math.abs(currentAngle - this.lastCamAngle);
    this.lastCamAngle = currentAngle;
    if (this.dragging && angleDiff > 0.0001) {
      soundEffects.playRotateAir(angleDiff / Math.max(0.001, dt));
    }

    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.update(easeInOut(k));
      if (k >= 1) {
        this.anim = null;
        a.done?.();
      }
    }

    const f = Math.min(1, dt * 6);
    this.lvl.sections += (this.lvlTarget.sections - this.lvl.sections) * f;
    this.lvl.ayat += (this.lvlTarget.ayat - this.lvl.ayat) * f;
    for (const it of this.fadeItems) {
      const o = it.base * this.globeFade * this.lvl[it.group];
      it.mat.opacity = o;
      it.mat.visible = o > 0.01;
    }
    this.sectionsGroup.visible = this.lvl.sections > 0.01;

    const camDir = this.tmpA.copy(this.camera.position).normalize();
    if (this.globeGroup.visible) {
      this.coreGroup.rotation.y += dt * 0.08;
      this.coreGroup.children.forEach((c) => {
        if (c.userData.spin) c.rotation.y += dt * c.userData.spin;
      });
      for (const n of this.nodes) {
        // dimTarget overrides (set by hover/filter) take priority; otherwise staggered reveal
        const revealed = now >= n.revealTime;
        const target = revealed
          ? ((n as SurahNode & { dimTarget?: number }).dimTarget ?? 1)
          : 0;
        n.dim += (target - n.dim) * f;
        const facing = n.normal.dot(camDir);
        const depth = 0.4 + 0.6 * clamp01((facing + 0.3) / 1.0);
        const hov = this.hoverNode === n;
        const listening = this.listenNode === n;
        const scaleTarget = listening ? 1.45 + (this.listenPlaying ? 0.5 * this.listenPulse : 0) : hov ? 1.75 : 1;
        n.scale += (scaleTarget - n.scale) * Math.min(1, dt * (listening ? 16 : 10));
        n.mesh.scale.setScalar(n.radius * n.scale);
        const o = this.globeFade * n.dim * depth;
        (n.mesh.material as THREE.Material).opacity = o;
        (n.mesh.material as THREE.Material).visible = o > 0.01;
        // Cloud shell: rotate around the planet's local up axis and match opacity
        n.cloudMesh.rotation.y += dt * n.cloudSpeed;
        n.cloudMesh.scale.setScalar(n.radius * n.scale * 1.045);
        (n.cloudMesh.material as THREE.Material).opacity = 0.75 * o;
        n.cloudMesh.visible = o > 0.01;
        (n.glow.material as THREE.Material).opacity = 0.9 * o;
        n.glow.visible = o > 0.01;
        n.glow.scale.setScalar(n.radius * n.scale * 6);
      }
    }

    // listening: decay the per-ayah beat, keep the label lit, run outward ripples
    if (this.listenPulse > 0) {
      this.listenPulse = Math.max(0, this.listenPulse - dt * 2.4);
      if (this.mode === 'surah' || this.mode === 'section') {
        this.updateListeningVisuals();
      }
    }
    if (this.listenNode) {
      this.listenNode.label.el.style.color = '#fde68a';
    }
    for (const r of [...this.ripples]) {
      r.age += dt;
      const k = r.age / 1.4;
      if (k >= 1 || !this.listenNode) {
        this.removeRipple(r);
        continue;
      }
      const base = this.listenNode.radius * this.listenNode.scale;
      r.sprite.scale.setScalar(base * (2.2 + 11 * (1 - Math.pow(1 - k, 2))));
      (r.sprite.material as THREE.SpriteMaterial).opacity = 0.85 * (1 - k) * this.globeFade;
    }
    this.ripples.forEach((r) => (r.sprite.visible = this.globeGroup.visible));

    // compare: pulsing rings on the chosen surahs + a spark travelling along the arc
    this.compareNodes.forEach((n, i) => {
      const ring = this.compareRings[i];
      if (!ring) return;
      if (!n) {
        ring.visible = false;
        return;
      }
      const facing = n.normal.dot(camDir);
      ring.visible = true;
      ring.scale.setScalar(n.radius * n.scale * (3.4 + 0.25 * Math.sin(now * 3 + i * 1.6)));
      (ring.material as THREE.SpriteMaterial).opacity = this.globeFade * n.dim * (0.35 + 0.65 * clamp01((facing + 0.25) / 0.6));
    });
    if (this.compareArc) {
      (this.compareArc.material as THREE.LineBasicMaterial).opacity = 0.9 * this.globeFade;
    }
    if (this.compareDot && this.compareCurve.length) {
      const t = (now * 0.35) % 1;
      const idx = Math.min(this.compareCurve.length - 1, Math.floor(t * (this.compareCurve.length - 1)));
      this.compareDot.position.copy(this.compareCurve[idx]);
      (this.compareDot.material as THREE.SpriteMaterial).opacity = this.globeFade;
    }

    this.hoverGroup.visible = this.mode === 'globe' && !!this.hoverNode;
    if (this.hoverNode) {
      const k = clamp01((now - this.hoverStart) / 0.45);
      this.hoverGroup.scale.setScalar(Math.max(0.001, 1 - Math.pow(1 - k, 3)));
    }

    if (this.pinnedNode && this.mode === 'globe') {
      if (this.hoverNode !== this.pinnedNode) this.setHoverNode(this.pinnedNode);
    } else if (!this.dragging && this.mouse.inside && !this.anim) this.updateHover();
    else if (!this.mouse.inside && !this.dragging) {
      if (this.mode === 'globe') this.setHoverNode(null);
      else if (this.mode === 'surah' || this.mode === 'section') this.setHoverPickable(null);
    }
    // While the camera follows a recited ayah inside its constellation, don't spin it away from the centre of the view.
    const followingAyah =
      this.mode === 'section' &&
      this.followCamera &&
      this.listenPlaying &&
      this.sectionScene?.node.meta.number === this.listenSurah &&
      this.listenAyah >= this.sectionScene.startAyah &&
      this.listenAyah <= this.sectionScene.endAyah;
    this.controls.autoRotate =
      (this.mode === 'globe' || this.mode === 'surah' || this.mode === 'section') &&
      !this.hoverNode &&
      !this.hoverPick &&
      !this.dragging &&
      !followingAyah &&
      !(this.mode === 'globe' && (this.listenPlaying || (this.compareNodes[0] && this.compareNodes[1])));

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  };

  private updateLabels() {
    this.scene.updateMatrixWorld();
    const camDir = this.tmpA.copy(this.camera.position).normalize();
    const v = this.tmpB;
    for (const l of this.labels) {
      v.copy(l.pos);
      if (l.parent) l.parent.localToWorld(v);
      let op = 1;
      let scale = 1;

      if (l.kind === 'globe') {
        if (l.node) {
          const node = l.node;
          const facing = node.normal.dot(camDir);
          op = clamp01((facing - 0.15) / 0.45) * this.globeFade * node.dim;
          if (this.level === 'ayat') op *= 0.8;
          if (this.hoverNode === node) scale = 1.2;
        } else {
          // Central core label (القرآن الكريم)
          op = this.globeFade * 0.95;
          scale = 1.0;
        }
      } else if (l.kind === 'section') {
        if (l.parent) {
          const parentScale = clamp01((l.parent.scale.x - 0.2) / 0.8);
          // Calculate front vs back facing of the sphere relative to camera view
          const nodeCenter = l.parent.position;
          const dirFromCenter = v.clone().sub(nodeCenter).normalize();
          // camDir points from target to camera. When point faces camera, dot is positive!
          const facing = dirFromCenter.dot(camDir);

          // Front-facing cards (facing > 0.12) are fully prominent and readable
          // Back-facing cards fade out completely so there is zero overlapping clutter!
          if (facing > 0.12) {
            op = parentScale;
            scale = 1.0;
          } else if (facing > -0.05) {
            // Smooth edge transition zone
            const edgeT = (facing - (-0.05)) / (0.12 - (-0.05));
            op = parentScale * smooth(0, 1, edgeT);
            scale = 0.9 + 0.1 * edgeT;
          } else {
            op = 0;
            scale = 0.8;
          }
        }
      } else if (l.parent) {
        op = clamp01((l.parent.scale.x - 0.4) / 0.6);
      }

      v.project(this.camera);
      if (v.z > 1 || op < 0.02) {
        l.el.style.opacity = '0';
        continue;
      }
      const x = (v.x * 0.5 + 0.5) * this.width;
      const y = (-v.y * 0.5 + 0.5) * this.height;
      l.el.style.opacity = String(op);

      const isHoveredSatellite = this.hoverPick?.label === l;
      const isListeningAyah =
        (this.mode === 'section' && this.sectionScene && this.listenSurah === this.sectionScene.node.meta.number &&
         this.sectionScene.pickables.some((p) => p.label === l && p.kind === 'ayah' && p.ayah === this.listenAyah && this.listenPlaying)) ||
        (this.mode === 'surah' && this.current && this.listenSurah === this.current.node.meta.number &&
         this.current.pickables.some((p) => p.label === l && p.kind === 'branch' && p.branchIndex !== undefined &&
           this.current?.res && this.current.res[this.listenAyah - 1]?.branch === p.branchIndex && this.listenPlaying));

      if (isListeningAyah) {
        scale = Math.max(scale, 1.15 + (this.listenPulse > 0 ? 0.08 * this.listenPulse : 0));
        op = Math.max(op, 0.95);
      }

      // Following a recited ayah: show its whole text (any length) so the user can read along without overlap.
      if (l.kind === 'section') {
        const sec = this.sectionScene;
        const expand = isListeningAyah && this.followCamera && this.mode === 'section' && !!sec;
        const txtEl = l.el.querySelector<HTMLElement>('.ayah-txt');
        if (txtEl && (txtEl.dataset.exp === '1') !== expand) {
          txtEl.dataset.exp = expand ? '1' : '0';
          const pk = sec?.pickables.find((p) => p.label === l);
          if (expand) {
            const full = pk?.info.ayahText;
            if (full) txtEl.textContent = full;
            txtEl.style.cssText += ';display:block;-webkit-line-clamp:unset;overflow:visible;max-width:min(460px,80vw);font-size:16px;line-height:1.8;text-align:center;';
            l.el.style.zIndex = '5';
          } else {
            const full = pk?.info.ayahText;
            if (full) txtEl.textContent = full.length > 55 ? full.slice(0, 52) + '…' : full;
            txtEl.style.display = '-webkit-box';
            txtEl.style.webkitLineClamp = '2';
            txtEl.style.overflow = 'hidden';
            txtEl.style.maxWidth = '';
            txtEl.style.fontSize = '';
            txtEl.style.lineHeight = '';
            txtEl.style.textAlign = '';
            l.el.style.zIndex = '';
            l.el.style.transformOrigin = '';
          }
        }
      }
      if (isHoveredSatellite) scale = 1.32;

      let top = y + l.offsetY;
      let left = x;
      if (l.kind === 'section' && l.el.querySelector<HTMLElement>('.ayah-txt')?.dataset.exp === '1') {
        // Expanded (followed) ayah: keep the whole card inside the free band between the header and the bottom buttons.
        const topMargin = 84;
        const bottomMargin = 120;
        const avail = Math.max(120, this.height - topMargin - bottomMargin);
        const h = l.el.offsetHeight || 1;
        scale = Math.min(1, avail / h);
        l.el.style.transformOrigin = '50% 0';
        top = Math.min(Math.max(top, topMargin), this.height - bottomMargin - h * scale);
        // Same for the sides: keep the whole card on screen even if the ayah itself has drifted to the edge.
        const sideMargin = 12;
        const halfW = ((l.el.offsetWidth || 1) * scale) / 2;
        if (halfW * 2 + sideMargin * 2 < this.width) {
          left = Math.min(Math.max(left, sideMargin + halfW), this.width - sideMargin - halfW);
        } else {
          left = this.width / 2;
        }
      }

      l.el.style.transform = `translate(${left.toFixed(1)}px,${top.toFixed(1)}px) translate(-50%,0) scale(${scale})`;
    }
  }
}

export const MECCAN_HEX = MECCAN_COLOR;
export const MEDINAN_HEX = MEDINAN_COLOR;
