import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  PLANETS,
  satelliteRenderSize,
  SCENE_EXTENT,
  type PlanetId,
  type PlanetSpec,
  type SolarChapter,
  type SolarFocus,
  type SolarModel,
  type SolarStation,
} from "../solar";
import {
  disposeSolarTextures,
  moonTexture,
  planetTextures,
  radialTexture,
  skyStars,
  starTexture,
  sunTexture,
  type Detail,
} from "../solarTextures";
import {
  BELT_CENTER,
  BELT_INNER,
  BELT_OUTER,
  BELT_SPAN,
  SIM_WORLDS,
  type SimWorld,
} from "../worlds";

export interface SolarHover {
  kind: "planet" | "chapter" | "station" | "sun" | "belt" | "world";
  planetId: PlanetId | null;
  chapterId: string | null;
  stationId: string | null;
  worldId?: SimWorld["id"] | null;
  title: string;
  meta: string;
}

interface Props {
  model: SolarModel;
  focus: SolarFocus;
  ambient?: boolean;
  inset?: number;
  insetY?: number;
  onFocus: (focus: SolarFocus) => void;
  onHover: (hover: SolarHover | null) => void;
  onOpenStation: (chapter: SolarChapter, station: SolarStation) => void;
  onOpenSun: () => void;
  onOpenBelt?: () => void;
  onReady: () => void;
  onFallback: () => void;
}

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

interface SatelliteEntry {
  chapter: SolarChapter;
  holder: THREE.Group;
  model: THREE.Group;
  hit: THREE.Mesh;
  size: number;
  orbitLine: THREE.Line;
  spin: number;
  label: HTMLDivElement;
  stationGroup: THREE.Group;
  stationHits: THREE.Mesh[];
  stationVisitedKey: string;
}

interface PlanetEntry {
  spec: PlanetSpec;
  root: THREE.Group;
  tilt: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  clouds: THREE.Mesh | null;
  cloudMaterial: THREE.MeshStandardMaterial | null;
  ring: THREE.Mesh | null;
  ringMaterial: THREE.MeshStandardMaterial | null;
  orbitLine: THREE.Line;
  satelliteGroup: THREE.Group;
  satellites: SatelliteEntry[];
  label: HTMLDivElement;
  labelMeta: HTMLElement;
  labelBar: HTMLElement;
  detail: Detail;
  nearTimer: number | null;
}

interface Bundle {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  sunMesh: THREE.Mesh;
  sunGroup: THREE.Group;
  sunLabel: HTMLDivElement;
  pointLight: THREE.PointLight;
  saturnSpot: THREE.SpotLight;
  stars: THREE.Points[];
  nebulae: THREE.Sprite[];
  planets: PlanetEntry[];
  labels: HTMLDivElement;
  pickables: THREE.Object3D[];
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  width: number;
  height: number;
  syncModel: (model: SolarModel) => void;
  applyFocus: (focus: SolarFocus) => void;
  setInset: (inset: number) => void;
  setInsetY: (inset: number) => void;
  setAmbient: (value: boolean) => void;
  inset: number;
  insetY: number;
  dispose: () => void;
}

/* Khoảng cách mặc định: trọn tầm với lớn nhất của hệ theo chiều dọc màn hình. */
const CAMERA_FOV = 42;
const FIT_DISTANCE = (SCENE_EXTENT / Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180)) * 1.06;

const SYSTEM_POSE: Pose = {
  position: new THREE.Vector3(0, FIT_DISTANCE * 0.62, FIT_DISTANCE * 0.78),
  target: new THREE.Vector3(0, 0, 0),
};

const EARTH_LABEL_COLOR = "#ffc477";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function planetPosition(spec: PlanetSpec, time: number): THREE.Vector3 {
  const angle = spec.phase + time * spec.orbitSpeed;
  return new THREE.Vector3(Math.cos(angle) * spec.orbit, 0, Math.sin(angle) * spec.orbit);
}

function worldPosition(spec: SimWorld, time: number): THREE.Vector3 {
  const angle = spec.phase + time * spec.speed;
  /* Cả bốn nằm phẳng trên một vòng tròn nên đội hình chữ thập giữ nguyên hình. */
  return new THREE.Vector3(Math.cos(angle) * spec.orbit, 0, Math.sin(angle) * spec.orbit);
}

function satelliteLocal(chapter: SolarChapter, time: number): THREE.Vector3 {
  const angle = chapter.phase + time * chapter.speed;
  return new THREE.Vector3(
    Math.cos(angle) * chapter.orbitRadius,
    Math.sin(angle * 2 + chapter.phase) * chapter.orbitRadius * 0.045,
    Math.sin(angle) * chapter.orbitRadius
  );
}

function craftSize(spec: PlanetSpec): number {
  return satelliteRenderSize(spec);
}

function satelliteSize(chapter: SolarChapter, spec: PlanetSpec): number {
  if (chapter.kind === "natural" && chapter.moon) return satelliteRenderSize(spec, chapter.moon.radius);
  return craftSize(spec);
}

function circleLine(radius: number, color: number, opacity: number): THREE.Line {
  const points: THREE.Vector3[] = [];
  const segments = 180;
  for (let i = 0; i <= segments; i += 1) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.rotation.x = 0;
  return line;
}

function atmosphereMaterial(color: string, intensity: number): THREE.ShaderMaterial {
  const tint = new THREE.Color(color);
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: tint },
      uIntensity: { value: intensity },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        vWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vView;
      varying vec3 vWorld;
      void main() {
        float rim = pow(1.0 - max(dot(vNormal, vView), 0.0), 2.6);
        float sun = smoothstep(-0.45, 0.5, dot(vWorld, normalize(vec3(1.0, 0.2, 0.6))));
        float alpha = rim * uIntensity * (0.35 + sun * 0.85);
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.BackSide,
  });
}

function glowSprite(color: string, inner: string, scale: number, opacity: number): THREE.Sprite {
  const texture = radialTexture(
    inner,
    color,
    [
      [0, inner, 0.95],
      [0.22, color, 0.55],
      [0.55, color, 0.16],
      [1, color, 0],
    ],
    256
  );
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  return sprite;
}

function makeCraft(chapter: SolarChapter, spec: PlanetSpec): THREE.Group {
  const size = craftSize(spec);
  const group = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({
    color: 0xc4a76c,
    metalness: 0.85,
    roughness: 0.38,
    emissive: 0x2a1c08,
    emissiveIntensity: 0.2,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x8b93a3,
    metalness: 0.8,
    roughness: 0.42,
  });
  const panel = new THREE.MeshStandardMaterial({
    color: 0x1c3d78,
    metalness: 0.55,
    roughness: 0.28,
    emissive: 0x1a4fa8,
    emissiveIntensity: 0.5,
  });

  if (chapter.craft === "telescope") {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.34, size * 0.34, size * 1.5, 18), dark);
    tube.rotation.z = Math.PI / 2;
    group.add(tube);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.4, size * 0.4, size * 0.18, 18, 1, true), gold);
    hood.rotation.z = Math.PI / 2;
    hood.position.x = size * 0.74;
    group.add(hood);
    const panelA = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, size * 0.03, size * 0.5), panel);
    panelA.position.set(-size * 0.12, -size * 0.5, 0);
    group.add(panelA);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.02, size * 0.02, size * 0.5, 8), dark);
    mast.position.set(-size * 0.12, -size * 0.25, 0);
    group.add(mast);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(size * 0.58, size * 0.5, size * 0.8), gold);
    group.add(body);
    const panelGeo = new THREE.BoxGeometry(size * 1.35, size * 0.03, size * 0.55);
    const panelA = new THREE.Mesh(panelGeo, panel);
    panelA.position.x = -size * 1.02;
    group.add(panelA);
    const panelB = new THREE.Mesh(panelGeo, panel);
    panelB.position.x = size * 1.02;
    group.add(panelB);
    const boomA = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.02, size * 0.02, size * 0.9, 6), dark);
    boomA.rotation.z = Math.PI / 2;
    boomA.position.x = -size * 0.5;
    group.add(boomA);
    const boomB = boomA.clone();
    boomB.position.x = size * 0.5;
    group.add(boomB);

    if (chapter.craft === "comms") {
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.26, size * 0.06, size * 0.1, 22, 1, true), panel);
      dish.position.set(0, size * 0.44, 0);
      dish.rotation.x = 0.35;
      group.add(dish);
      const dishBack = new THREE.Mesh(new THREE.SphereGeometry(size * 0.08, 12, 8), dark);
      dishBack.position.set(0, size * 0.34, 0);
      group.add(dishBack);
    } else if (chapter.craft === "observer") {
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.14, size * 0.18, size * 0.46, 16), dark);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0, size * 0.55);
      group.add(lens);
      const glass = new THREE.Mesh(
        new THREE.CircleGeometry(size * 0.13, 16),
        new THREE.MeshStandardMaterial({ color: 0x9fd8ff, metalness: 0.3, roughness: 0.08, emissive: 0x1d5f9a, emissiveIntensity: 0.6 })
      );
      glass.position.set(0, 0, size * 0.79);
      group.add(glass);
    } else {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.012, size * 0.012, size * 0.7, 6), dark);
      rod.position.y = size * 0.55;
      group.add(rod);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(size * 0.055, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xf4f7ff })
      );
      tip.position.y = size * 0.92;
      group.add(tip);
    }

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.035, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff6b4a })
    );
    beacon.position.set(size * 0.3, -size * 0.3, size * 0.3);
    group.add(beacon);
  }

  if (chapter.kind === "artificial") {
    group.rotation.set(0.2 + (chapter.phase % 1) * 0.5, chapter.phase, 0.1);
  }
  return group;
}

function makeMoon(chapter: SolarChapter): THREE.Group {
  const moon = chapter.moon;
  if (!moon) return new THREE.Group();
  const geometry =
    moon.kind === "phobos"
      ? (() => {
          const geo = new THREE.IcosahedronGeometry(moon.radius, 2);
          const pos = geo.attributes.position as THREE.BufferAttribute;
          for (let i = 0; i < pos.count; i += 1) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const wave = 1 + Math.sin(x * 19 + y * 13) * 0.07 + Math.cos(z * 17 - y * 11) * 0.06;
            pos.setXYZ(i, x * wave, y * wave * 0.86, z * wave);
          }
          geo.computeVertexNormals();
          return geo;
        })()
      : new THREE.SphereGeometry(moon.radius, 36, 24);
  const material = new THREE.MeshStandardMaterial({
    map: moonTexture(moon.kind, moon.seed),
    roughness: 0.94,
    metalness: 0.02,
  });
  const mesh = new THREE.Mesh(geometry, material);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

export default function SolarSystem({
  model,
  focus,
  ambient = false,
  inset = 0,
  insetY = 0,
  onFocus,
  onHover,
  onOpenStation,
  onOpenSun,
  onOpenBelt,
  onReady,
  onFallback,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<Bundle | null>(null);
  const propsRef = useRef({ model, focus, ambient, inset, insetY, onFocus, onHover, onOpenStation, onOpenSun, onOpenBelt, onReady, onFallback });
  const elapsedRef = useRef(0);
  const frozenPlanetRef = useRef(0);
  const frozenChapterRef = useRef(0);
  const focusRef = useRef(focus);
  const ambientRef = useRef(false);
  const prevFocusRef = useRef<SolarFocus | null>(null);
  const hoverRef = useRef<{ kind: SolarHover["kind"]; planetId: PlanetId | null; chapterId: string | null } | null>(null);
  const hoverKeyRef = useRef("");
  const memoryRef = useRef<{ system: Pose | null; planets: Map<string, Pose>; chapters: Map<string, Pose> }>({
    system: null,
    planets: new Map(),
    chapters: new Map(),
  });

  useEffect(() => {
    propsRef.current = { model, focus, ambient, inset, insetY, onFocus, onHover, onOpenStation, onOpenSun, onOpenBelt, onReady, onFallback };
  });

  /* ------------------------------ dựng scene ------------------------------ */
  useEffect(() => {
    const host = hostRef.current;
    const labels = labelsRef.current;
    if (!host || !labels) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
      });
    } catch {
      propsRef.current.onFallback();
      return;
    }
    if (!renderer.getContext()) {
      propsRef.current.onFallback();
      return;
    }

    const quality = window.matchMedia("(max-width: 760px)").matches ? "low" : "high";
    /* Toàn màn hình + shadow map mềm: render ở 2x DPR làm GPU quá tải (đo được 17fps). */
    const pixelRatio = () => Math.min(window.devicePixelRatio || 1, quality === "low" ? 1 : 1.5);
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "solar-webgl";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03050c);

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, (host.clientWidth || 1) / (host.clientHeight || 1), 0.05, 1200);
    camera.position.copy(SYSTEM_POSE.position);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.9;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 1.2;
    controls.maxDistance = FIT_DISTANCE * 2.4;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = Math.PI - 0.12;
    controls.autoRotate = false;

    const sunGroup = new THREE.Group();
    scene.add(sunGroup);
    const sunMaterial = new THREE.MeshBasicMaterial({ map: sunTexture(), toneMapped: false });
    const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 64, 40), sunMaterial);
    sunMesh.userData = { kind: "sun" };
    sunGroup.add(sunMesh);
    const glowInner = glowSprite("#ffbe55", "#fff6d8", 8.2, 0.75);
    const glowOuter = glowSprite("#ff8a2a", "#ffd89a", 16.5, 0.32);
    sunGroup.add(glowInner, glowOuter);

    const pointLight = new THREE.PointLight(0xfff2dc, 2.35, 0, 0);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);
    scene.add(new THREE.AmbientLight(0x35507a, 0.16));
    const hemi = new THREE.HemisphereLight(0x4c6f9f, 0x04060c, 0.12);
    scene.add(hemi);
    // Đèn phụ gắn theo camera: giữ chi tiết cho mặt tối khi soi gần.
    const fillLight = new THREE.DirectionalLight(0xdce8ff, 0.12);
    scene.add(fillLight, fillLight.target);

    const saturnSpot = new THREE.SpotLight(0xfff4e2, 0, 0, 0.44, 0.45, 0);
    saturnSpot.castShadow = true;
    saturnSpot.shadow.mapSize.set(1024, 1024);
    saturnSpot.shadow.camera.near = 1;
    saturnSpot.shadow.camera.far = 34;
    saturnSpot.shadow.bias = -0.0008;
    saturnSpot.visible = false;
    scene.add(saturnSpot);
    scene.add(saturnSpot.target);

    // Bầu trời: sao nhiều tầng + tinh vân mờ
    const starData = skyStars(quality === "low" ? 1500 : 3600);
    const stars: THREE.Points[] = [];
    const buildStars = (limitLow: number, limitHigh: number, sizeValue: number, opacity: number) => {
      const positions: number[] = [];
      const colors: number[] = [];
      for (let i = 0; i < starData.sizes.length; i += 1) {
        const s = starData.sizes[i];
        if (s < limitLow || s >= limitHigh) continue;
        positions.push(starData.positions[i * 3], starData.positions[i * 3 + 1], starData.positions[i * 3 + 2]);
        colors.push(starData.colors[i * 3], starData.colors[i * 3 + 1], starData.colors[i * 3 + 2]);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        size: sizeValue,
        map: starTexture(),
        vertexColors: true,
        transparent: true,
        opacity,
        depthWrite: false,
        alphaTest: 0.02,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(geometry, material);
      scene.add(points);
      stars.push(points);
    };
    buildStars(0, 1.4, 0.9, 0.55);
    buildStars(1.4, 3.4, 1.9, 0.9);

    const nebulae: THREE.Sprite[] = [];
    const nebulaSpecs: [string, string, number, number, number, number][] = [
      ["#243f83", "#6f8fe0", 120, 0.1, 160, 40],
      ["#3b2468", "#8b6ec9", 150, 0.07, -120, 120],
      ["#0d4358", "#57b6c9", 130, 0.06, 60, -170],
    ];
    for (const [base, inner, scale, opacity, x, y] of nebulaSpecs) {
      const sprite = glowSprite(base, inner, scale, opacity);
      sprite.position.set(x, y, -180);
      scene.add(sprite);
      nebulae.push(sprite);
    }

    /* Vành đai tiểu hành tinh = khu kiểm tra đánh giá; ba thế giới mô phỏng
       giả tưởng nằm trong vành đai, mỗi thế giới một vật liệu riêng. */
    const beltGroup = new THREE.Group();
    beltGroup.rotation.x = 0.05;
    scene.add(beltGroup);

    const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
    const rockMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.82,
      metalness: 0.14,
      flatShading: true,
      emissive: 0x1b2436,
      emissiveIntensity: 0.45,
    });
    const rockCount = quality === "low" ? 420 : 900;
    const beltRocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount);
    const rockPlace = new THREE.Object3D();
    const rockTints = [
      new THREE.Color("#c8d3e6"),
      new THREE.Color("#9aa6bd"),
      new THREE.Color("#d8b48f"),
      new THREE.Color("#7f8ba4"),
      new THREE.Color("#e6d9c2"),
    ];
    for (let i = 0; i < rockCount; i += 1) {
      /* Gom đá về hai dải sáng để vành đai có kết cấu, không phải một đám mù. */
      const band = Math.random() < 0.62 ? 0.34 : 0.72;
      const radius = BELT_INNER + BELT_SPAN * (band + (Math.random() - 0.5) * 0.26);
      const angle = Math.random() * Math.PI * 2;
      rockPlace.position.set(
        Math.cos(angle) * radius,
        (Math.random() - 0.5) * 0.5,
        Math.sin(angle) * radius
      );
      rockPlace.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      const chunk = Math.random();
      rockPlace.scale.set(
        0.022 + chunk * 0.075,
        (0.02 + Math.random() * 0.06) * 0.8,
        0.022 + Math.random() * 0.07
      );
      rockPlace.updateMatrix();
      beltRocks.setMatrixAt(i, rockPlace.matrix);
      beltRocks.setColorAt(i, rockTints[i % rockTints.length]);
    }
    beltRocks.instanceMatrix.needsUpdate = true;
    if (beltRocks.instanceColor) beltRocks.instanceColor.needsUpdate = true;
    beltGroup.add(beltRocks);

    /* Bụi sáng + hai mép phát quang: vành đai phải nổi bật giữa hệ. */
    const dustBand = new THREE.Mesh(
      new THREE.TorusGeometry(BELT_CENTER, BELT_SPAN / 2, 2, 128),
      new THREE.MeshBasicMaterial({
        color: 0x8fb6e8,
        transparent: true,
        opacity: 0.11,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    dustBand.rotation.x = Math.PI / 2;
    dustBand.scale.set(1, 1, 0.22);
    beltGroup.add(dustBand);

    for (const [edge, alpha] of [
      [BELT_INNER, 0.3],
      [BELT_OUTER, 0.22],
    ] as const) {
      const edgeLine = circleLine(edge, 0xbcd8ff, alpha);
      beltGroup.add(edgeLine);
    }
    /* Vòng chung của bốn trạm: cho thấy chúng đứng trên đúng một quỹ đạo. */
    beltGroup.add(circleLine(BELT_CENTER, 0xe6d2dc, 0.2));

    /* Vành chạm chỉ là một ống mảnh nằm giữa dải đá; nếu dày, nó nuốt luôn ba
       thế giới phòng lab cùng bán kính và không tài nào bấm được. */
    const beltHit = new THREE.Mesh(
      new THREE.TorusGeometry((BELT_INNER + BELT_OUTER) / 2, 0.9, 3, 96),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    beltHit.rotation.x = Math.PI / 2;
    beltHit.userData = { kind: "belt" };
    beltGroup.add(beltHit);

    interface WorldEntry {
      spec: SimWorld;
      group: THREE.Group;
      hit: THREE.Mesh;
      spin: number;
    }
    const worlds: WorldEntry[] = [];

    /* Bộ phận phụ xoay quanh hành tinh và đèn nhấp nháy — gom lại để vòng lặp
       render chỉ việc chạy qua, không phải duyệt cây mỗi khung hình. */
    const worldSpinners: { obj: THREE.Object3D; speed: number }[] = [];
    const worldBlinkers: { mesh: THREE.Mesh; base: number; speed: number; phase: number }[] = [];

    const worldBody = (spec: SimWorld) => {
      const size = spec.size;
      const accent = new THREE.Color(spec.color).getHex();
      const group = new THREE.Group();
      let body: THREE.Mesh;

      if (spec.surface === "crystal") {
        /* Tinh thể cắt được: lõi đa diện + cạnh sáng + mặt phẳng cắt + mảnh vụn. */
        body = new THREE.Mesh(
          new THREE.OctahedronGeometry(size * 1.34, 0),
          new THREE.MeshStandardMaterial({
            color: spec.color,
            flatShading: true,
            roughness: 0.16,
            metalness: 0.56,
            emissive: spec.glow,
            emissiveIntensity: 0.46,
          })
        );
        body.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(body.geometry),
            new THREE.LineBasicMaterial({ color: 0xf2ecff, transparent: true, opacity: 0.5, depthWrite: false })
          )
        );
        /* Hai mặt phẳng cắt cắt nhau — đúng thứ người học cầm trong tay ở phòng hình học. */
        const cut = circleLine(size * 1.9, accent, 0.6);
        cut.rotation.set(Math.PI / 2, 0, 0.42);
        worldSpinners.push({ obj: cut, speed: 0.55 });
        const cutB = circleLine(size * 1.55, 0xf2ecff, 0.3);
        cutB.rotation.set(Math.PI / 2 + 0.7, 0, -0.3);
        worldSpinners.push({ obj: cutB, speed: -0.38 });
        group.add(cut, cutB);

        const shards = new THREE.Group();
        for (let i = 0; i < 3; i += 1) {
          const shard = new THREE.Mesh(
            new THREE.OctahedronGeometry(size * 0.2, 0),
            new THREE.MeshStandardMaterial({
              color: spec.color,
              flatShading: true,
              roughness: 0.2,
              metalness: 0.5,
              emissive: spec.glow,
              emissiveIntensity: 1.2,
            })
          );
          const a = (i / 3) * Math.PI * 2;
          shard.position.set(Math.cos(a) * size * 1.6, Math.sin(a * 1.7) * size * 0.3, Math.sin(a) * size * 1.6);
          shard.rotation.set(a, a * 1.3, 0);
          shards.add(shard);
        }
        worldSpinners.push({ obj: shards, speed: 0.8 });
        group.add(shards);
        group.add(glowSprite(spec.glow, "#efe6ff", size * 6.4, 0.34));
      } else if (spec.surface === "ember") {
        /* Lò phản ứng: cầu dung nham + vòng khí + ba phân tử bay quanh. */
        body = new THREE.Mesh(
          new THREE.SphereGeometry(size, 28, 20),
          new THREE.MeshStandardMaterial({
            color: spec.color,
            roughness: 0.62,
            metalness: 0.08,
            emissive: spec.glow,
            emissiveIntensity: 0.85,
          })
        );
        const haze = new THREE.Mesh(
          new THREE.TorusGeometry(size * 1.6, size * 0.06, 10, 48),
          new THREE.MeshBasicMaterial({
            color: 0xffc078,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        haze.rotation.set(Math.PI / 2 - 0.28, 0, 0.2);
        worldSpinners.push({ obj: haze, speed: 0.35 });
        group.add(haze);

        const atoms = new THREE.Group();
        for (let i = 0; i < 3; i += 1) {
          const atom = new THREE.Mesh(
            new THREE.SphereGeometry(size * 0.18, 12, 8),
            new THREE.MeshStandardMaterial({
              color: 0xffd9a0,
              roughness: 0.4,
              metalness: 0.1,
              emissive: 0xff8a3c,
              emissiveIntensity: 1.6,
            })
          );
          const a = (i / 3) * Math.PI * 2;
          atom.position.set(Math.cos(a) * size * 1.58, Math.cos(a * 1.6) * size * 0.34, Math.sin(a) * size * 1.58);
          atoms.add(atom);
        }
        worldSpinners.push({ obj: atoms, speed: 1.05 });
        group.add(atoms);
        group.add(glowSprite(spec.glow, "#ffe6b8", size * 6.8, 0.4));
      } else if (spec.surface === "polyglot") {
        /* Lõi chữ: đá nguội bọc lưới ngữ liệu, hai quỹ đạo và những ký tự nhỏ. */
        body = new THREE.Mesh(
          new THREE.IcosahedronGeometry(size, 0),
          new THREE.MeshStandardMaterial({
            color: spec.color,
            flatShading: true,
            roughness: 0.5,
            metalness: 0.34,
            emissive: spec.glow,
            emissiveIntensity: 0.5,
          })
        );
        const shell = new THREE.Mesh(
          new THREE.IcosahedronGeometry(size * 1.52, 0),
          new THREE.MeshBasicMaterial({
            color: spec.color,
            wireframe: true,
            transparent: true,
            opacity: 0.34,
            depthWrite: false,
          })
        );
        group.add(shell);

        const orbitA = circleLine(size * 1.9, accent, 0.52);
        orbitA.rotation.set(Math.PI / 2 - 0.34, 0, 0.5);
        worldSpinners.push({ obj: orbitA, speed: 0.42 });
        const orbitB = circleLine(size * 1.66, 0xffd7e2, 0.34);
        orbitB.rotation.set(Math.PI / 2 + 0.42, 0, -0.8);
        worldSpinners.push({ obj: orbitB, speed: -0.6 });
        group.add(orbitA, orbitB);

        const glyphs = new THREE.Group();
        for (let i = 0; i < 5; i += 1) {
          const glyph = new THREE.Mesh(
            new THREE.BoxGeometry(size * 0.11, size * 0.11, size * 0.11),
            new THREE.MeshStandardMaterial({
              color: 0xffd9e2,
              roughness: 0.35,
              metalness: 0.2,
              emissive: spec.color,
              emissiveIntensity: 1.4,
            })
          );
          const a = (i / 5) * Math.PI * 2;
          glyph.position.set(Math.cos(a) * size * 1.72, Math.sin(a * 1.9) * size * 0.36, Math.sin(a) * size * 1.72);
          glyph.rotation.set(a, a, a * 0.6);
          glyphs.add(glyph);
        }
        worldSpinners.push({ obj: glyphs, speed: 0.9 });
        group.add(glyphs);
        group.add(glowSprite(spec.glow, "#ffd7e2", size * 6, 0.34));
      } else {
        /* Tiểu hành tinh khắc mạch in: khối đá thẫm làm thân, phiến mạch nằm trên
           mặt phẳng, chip ở giữa và ba LED nhấp theo nhịp. */
        body = new THREE.Mesh(
          new THREE.IcosahedronGeometry(size * 1.24, 0),
          new THREE.MeshStandardMaterial({
            color: 0x1a2a33,
            flatShading: true,
            roughness: 0.84,
            metalness: 0.26,
            emissive: 0x0a1a22,
            emissiveIntensity: 0.5,
          })
        );
        body.scale.set(1.02, 0.6, 1.02);

        const board = new THREE.Mesh(
          new THREE.BoxGeometry(size * 1.5, size * 0.18, size * 1.5),
          new THREE.MeshStandardMaterial({
            color: 0x0e2b33,
            roughness: 0.34,
            metalness: 0.6,
            emissive: spec.glow,
            emissiveIntensity: 0.32,
          })
        );
        board.position.y = size * 0.8;
        board.rotation.y = 0.36;
        board.add(
          new THREE.LineSegments(
            new THREE.EdgesGeometry(board.geometry),
            new THREE.LineBasicMaterial({ color: spec.color, transparent: true, opacity: 0.8, depthWrite: false })
          )
        );

        /* Hai đường mạch khắc trên mặt bo. */
        const trace = circleLine(size * 0.52, accent, 0.5);
        trace.rotation.x = Math.PI / 2;
        trace.position.y = size * 0.1;
        const traceB = circleLine(size * 0.3, 0xffd7a0, 0.34);
        traceB.rotation.x = Math.PI / 2;
        traceB.position.y = size * 0.1;
        board.add(trace, traceB);

        const chip = new THREE.Mesh(
          new THREE.BoxGeometry(size * 0.42, size * 0.14, size * 0.42),
          new THREE.MeshStandardMaterial({
            color: 0x07181d,
            roughness: 0.35,
            metalness: 0.7,
            emissive: spec.glow,
            emissiveIntensity: 0.45,
          })
        );
        chip.position.y = size * 0.14;
        board.add(chip);

        const ledColors = [0x64ffb4, 0x67e8f9, 0xffb347];
        for (let i = 0; i < 3; i += 1) {
          const led = new THREE.Mesh(
            new THREE.BoxGeometry(size * 0.11, size * 0.07, size * 0.11),
            new THREE.MeshStandardMaterial({
              color: 0x0c2228,
              roughness: 0.3,
              metalness: 0.2,
              emissive: ledColors[i],
              emissiveIntensity: 2.4,
            })
          );
          led.position.set((i - 1) * size * 0.55, size * 0.12, size * 0.44);
          worldBlinkers.push({ mesh: led, base: 2.4, speed: 1.6 + i * 0.7, phase: i * 2.1 });
          board.add(led);
        }
        group.add(board);

        const ring = circleLine(size * 2.0, accent, 0.42);
        ring.rotation.x = Math.PI / 2;
        worldSpinners.push({ obj: ring, speed: 0.55 });
        group.add(ring);
        group.add(glowSprite(spec.glow, "#d9fffb", size * 5.4, 0.32));
      }

      group.add(body);
      return group;
    };

    for (const spec of SIM_WORLDS) {
      const group = worldBody(spec);
      const hit = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(spec.size * 1.9, 0.26), 10, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hit.userData = { kind: "world", worldId: spec.id, title: spec.name };
      group.add(hit);
      scene.add(group);
      worlds.push({ spec, group, hit, spin: 0.3 + (spec.phase % 1) * 0.4 });
    }

    const labelsHost = labels;
    labelsHost.innerHTML = "";
    const sunLabel = document.createElement("div");
    sunLabel.className = "solar-label solar-label-sun";
    const sunName = document.createElement("span");
    sunName.textContent = "AZ AI";
    const sunMeta = document.createElement("em");
    sunMeta.textContent = "TRÍ TUỆ TRUNG TÂM";
    sunLabel.append(sunName, sunMeta);
    labelsHost.appendChild(sunLabel);

    const planets: PlanetEntry[] = [];
    const pickables: THREE.Object3D[] = [];

    for (const spec of PLANETS) {
      const root = new THREE.Group();
      root.position.copy(planetPosition(spec, 0));
      const tilt = new THREE.Group();
      tilt.rotation.z = spec.tilt;
      root.add(tilt);

      const textures = planetTextures(spec.id, "far");
      const material = new THREE.MeshStandardMaterial({
        map: textures.map,
        bumpMap: textures.bump,
        bumpScale: clamp(spec.radius * 0.06, 0.01, 0.08),
        roughnessMap: textures.roughness,
        roughness: 0.88,
        metalness: spec.id === "earth" ? 0.05 : 0.02,
        emissive: new THREE.Color(spec.id === "earth" ? EARTH_LABEL_COLOR : spec.atmosphere),
        emissiveIntensity: spec.id === "earth" ? 0.4 : 0.015,
        emissiveMap: textures.emissive,
      });
      const segments = spec.radius > 0.8 ? 96 : 64;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(spec.radius, segments, Math.round(segments * 0.66)), material);
      mesh.userData = { kind: "planet", planetId: spec.id };
      mesh.receiveShadow = spec.id === "saturn";
      tilt.add(mesh);

      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(spec.radius * 1.035, 64, 40),
        atmosphereMaterial(spec.atmosphere, spec.atmosphereIntensity)
      );
      atmosphere.renderOrder = 2;
      tilt.add(atmosphere);

      let clouds: THREE.Mesh | null = null;
      let cloudMaterial: THREE.MeshStandardMaterial | null = null;
      if (textures.clouds) {
        cloudMaterial = new THREE.MeshStandardMaterial({
          map: textures.clouds,
          transparent: true,
          opacity: spec.id === "earth" ? 0.82 : 0.42,
          depthWrite: false,
          roughness: 1,
          metalness: 0,
        });
        clouds = new THREE.Mesh(new THREE.SphereGeometry(spec.radius * 1.012, 64, 40), cloudMaterial);
        clouds.renderOrder = 1;
        tilt.add(clouds);
      }

      let ring: THREE.Mesh | null = null;
      let ringMaterial: THREE.MeshStandardMaterial | null = null;
      if (spec.ring && textures.ring) {
        const inner = spec.radius * spec.ring.inner;
        const outer = spec.radius * spec.ring.outer;
        const ringGeometry = new THREE.RingGeometry(inner, outer, 180, 1);
        const uv = ringGeometry.attributes.uv as THREE.BufferAttribute;
        const position = ringGeometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < position.count; i += 1) {
          const px = position.getX(i);
          const py = position.getY(i);
          const radius = Math.sqrt(px * px + py * py);
          uv.setXY(i, clamp((radius - inner) / (outer - inner), 0, 1), 0.5);
        }
        uv.needsUpdate = true;
        ringMaterial = new THREE.MeshStandardMaterial({
          map: textures.ring,
          transparent: true,
          opacity: spec.ring.opacity,
          side: THREE.DoubleSide,
          roughness: 0.92,
          metalness: 0.03,
          depthWrite: false,
          alphaTest: 0.03,
        });
        ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.castShadow = spec.id === "saturn";
        ring.receiveShadow = true;
        tilt.add(ring);
      }

      const orbitLine = circleLine(spec.orbit, 0x5b7ca6, spec.id === "earth" ? 0.32 : 0.2);
      orbitLine.position.y = 0;
      scene.add(orbitLine);

      const satelliteGroup = new THREE.Group();
      root.add(satelliteGroup);

      const label = document.createElement("div");
      label.className = `solar-label solar-label-planet solar-label-${spec.id}`;
      const name = document.createElement("span");
      name.textContent = spec.name;
      const meta = document.createElement("em");
      const bar = document.createElement("i");
      bar.className = "solar-label-bar";
      const fill = document.createElement("b");
      bar.appendChild(fill);
      label.append(name, meta, bar);
      labelsHost.appendChild(label);

      scene.add(root);
      planets.push({
        spec,
        root,
        tilt,
        mesh,
        material,
        clouds,
        cloudMaterial,
        ring,
        ringMaterial,
        orbitLine,
        satelliteGroup,
        satellites: [],
        label,
        labelMeta: meta,
        labelBar: bar,
        detail: "far",
        nearTimer: null,
      });
    }

    let raf = 0;
    let frame = 0;
    const clock = { last: performance.now() };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(-2, -2);
    let flight: { from: Pose; to: Pose; t: number; duration: number } | null = null;
    let downPoint: { x: number; y: number } | null = null;
    let dragging = false;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const bundle: Bundle = {
      scene,
      camera,
      renderer,
      controls,
      sunMesh,
      sunGroup,
      sunLabel,
      pointLight,
      saturnSpot,
      stars,
      nebulae,
      planets,
      labels: labelsHost,
      pickables,
      raycaster,
      pointer,
      width: host.clientWidth || 1,
      height: host.clientHeight || 1,
      inset: 0,
      insetY: 0,
      syncModel: () => undefined,
      applyFocus: () => undefined,
      setInset: () => undefined,
      setInsetY: () => undefined,
      setAmbient: () => undefined,
      dispose: () => undefined,
    };

    const satTime = () => (focusRef.current.level === "chapter" ? frozenChapterRef.current : elapsedRef.current);

    const setPose = (pose: Pose, instant = false) => {
      if (instant || reducedMotion) {
        camera.position.copy(pose.position);
        controls.target.copy(pose.target);
        controls.update();
        flight = null;
        controls.enabled = true;
        return;
      }
      flight = {
        from: { position: camera.position.clone(), target: controls.target.clone() },
        to: { position: pose.position.clone(), target: pose.target.clone() },
        t: 0,
        duration: 1.25,
      };
      controls.enabled = false;
    };

    /** Dịch khung hình sang phải để chừa chỗ cho bảng chỉ mục bên trái. */
    const withInset = (pose: Pose): Pose => {
      const dist = pose.position.distanceTo(pose.target);
      if (dist < 0.001) return pose;
      const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
      const pxPerUnit = bundle.height / (2 * dist * tanHalf);
      const forward = pose.target.clone().sub(pose.position).normalize();
      const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();
      const inset = bundle.inset;
      if (inset > 1) {
        const shift = inset / 2 / Math.max(1, pxPerUnit);
        pose.position.addScaledVector(right, -shift);
        pose.target.addScaledVector(right, -shift);
      }
      // Bảng chỉ mục ở đáy (mobile): dịch vật thể lên trên vùng che.
      const insetY = bundle.insetY;
      if (insetY > 1) {
        const shift = insetY / 2 / Math.max(1, pxPerUnit);
        pose.position.addScaledVector(up, -shift);
        pose.target.addScaledVector(up, -shift);
      }
      return pose;
    };

    /** Hướng đặt camera về phía được Mặt Trời chiếu sáng, lệch nghiêng để thấy khối. */
    const litDirection = (world: THREE.Vector3): THREE.Vector3 => {
      const away = world.clone().normalize();
      const side = new THREE.Vector3().crossVectors(away, camera.up);
      if (side.lengthSq() < 0.0001) side.set(1, 0, 0);
      side.normalize();
      return away
        .clone()
        .multiplyScalar(-0.58)
        .addScaledVector(side, 0.9)
        .add(new THREE.Vector3(0, 0.38, 0))
        .normalize();
    };

    const planetPose = (entry: PlanetEntry): Pose => {
      const center = planetPosition(entry.spec, frozenPlanetRef.current);
      const fit = Math.max(1, 0.92 / Math.max(0.2, camera.aspect));
      const distance = (entry.spec.radius * 5.4 + 1.0) * fit;
      const position = center.clone().addScaledVector(litDirection(center), distance);
      return withInset({ position, target: center.clone() });
    };

    /** Phóng vào một thế giới phòng lab trong vành đai. */
    const worldPose = (entry: WorldEntry): Pose => {
      const center = worldPosition(entry.spec, frozenPlanetRef.current);
      const fit = Math.max(1, 0.92 / Math.max(0.2, camera.aspect));
      const distance = (entry.spec.size * 4.8 + 0.9) * fit;
      const position = center.clone().addScaledVector(litDirection(center), distance);
      return withInset({ position, target: center.clone() });
    };

    const chapterPose = (entry: PlanetEntry, satellite: SatelliteEntry): Pose => {
      const center = planetPosition(entry.spec, frozenPlanetRef.current);
      const local = satelliteLocal(satellite.chapter, frozenChapterRef.current);
      const world = center.clone().add(local);
      const fit = Math.max(1, 0.92 / Math.max(0.2, camera.aspect));
      const distance = (satellite.size * 10.5 + 0.85) * fit;
      // Nhìn ngang theo phương tiếp tuyến để hành tinh nằm lệch sang một bên,
      // không che mất vệ tinh đang học.
      const out = local.clone().setY(0).normalize();
      const sunward = world.clone().multiplyScalar(-1).normalize();
      const side = sunward.clone().addScaledVector(out, -sunward.dot(out));
      if (side.lengthSq() < 0.0001) side.set(0, 0, 1);
      side.normalize();
      const dir = out
        .clone()
        .multiplyScalar(0.3)
        .addScaledVector(side, 1)
        .add(new THREE.Vector3(0, 0.45, 0))
        .normalize();
      const position = world.clone().addScaledVector(dir, distance);
      return withInset({ position, target: world.clone() });
    };

    const refreshPickables = () => {
      pickables.length = 0;
      if (sunMesh.visible) pickables.push(sunMesh);
      const f = focusRef.current;
      if (f.level === "system" || f.level === "world") {
        pickables.push(beltHit);
        for (const world of worlds) pickables.push(world.hit);
      }
      for (const entry of planets) {
        if (f.level === "system" || f.level === "world") {
          pickables.push(entry.mesh);
          continue;
        }
        if (entry.spec.id !== f.planetId) continue;
        pickables.push(entry.mesh);
        for (const satellite of entry.satellites) {
          if (!satellite.holder.visible) continue;
          pickables.push(satellite.hit);
          if (f.level === "chapter" && f.chapterId === satellite.chapter.id) {
            for (const hit of satellite.stationHits) pickables.push(hit);
          }
        }
      }
    };

    const stationGlowUnvisited = radialTexture(
      "#ffffff",
      "#9fc4ff",
      [
        [0, "#ffffff", 0.9],
        [0.3, "#d5e6ff", 0.45],
        [1, "#7fb0ff", 0],
      ],
      128
    );
    const stationGlowVisited = radialTexture(
      "#ffe6b0",
      "#ffb347",
      [
        [0, "#fff6dd", 0.95],
        [0.3, "#ffd88a", 0.5],
        [1, "#ff9c2e", 0],
      ],
      128
    );

    const buildStationDecor = (entry: PlanetEntry, satellite: SatelliteEntry) => {
      const group = satellite.stationGroup;
      while (group.children.length > 0) group.remove(group.children[0]);
      satellite.stationHits = [];
      const stations = satellite.chapter.stations;
      const key = stations.map((station) => `${station.id}:${station.visited ? 1 : 0}`).join("|");
      satellite.stationVisitedKey = key;
      if (stations.length === 0) {
        refreshPickables();
        return;
      }
      const ringRadius = satellite.size * 2.6 + 0.1;
      const ringLine = circleLine(ringRadius, 0xbcd3f0, 0.24);
      group.add(ringLine);

      stations.forEach((station, index) => {
        const angle = (index / stations.length) * Math.PI * 2 + 0.5;
        const radius = ringRadius * (0.82 + (index % 2) * 0.22);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = Math.sin(index * 1.7) * ringRadius * 0.1;
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(clamp(satellite.size * 0.12, 0.006, 0.024), 12, 10),
          new THREE.MeshBasicMaterial({ color: station.visited ? 0xffd28a : 0xdbe8ff })
        );
        dot.position.set(x, y, z);
        group.add(dot);
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: station.visited ? stationGlowVisited : stationGlowUnvisited,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        glow.position.copy(dot.position);
        glow.scale.setScalar(clamp(satellite.size * 0.9, 0.05, 0.16));
        group.add(glow);
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(clamp(satellite.size * 0.32, 0.014, 0.055), 10, 8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        hit.position.copy(dot.position);
        hit.userData = {
          kind: "station",
          planetId: entry.spec.id,
          chapterId: satellite.chapter.id,
          stationId: station.id,
          title: station.label,
        };
        group.add(hit);
        satellite.stationHits.push(hit);
      });
      refreshPickables();
    };

    const removeSatellites = (entry: PlanetEntry) => {
      for (const satellite of entry.satellites) {
        satellite.label.remove();
        satellite.holder.parent?.remove(satellite.holder);
        satellite.orbitLine.parent?.remove(satellite.orbitLine);
        satellite.holder.traverse((object) => {
          const mesh = object as THREE.Mesh;
          mesh.geometry?.dispose();
          const material = mesh.material;
          if (Array.isArray(material)) material.forEach((item) => item.dispose());
          else material?.dispose();
        });
      }
      entry.satellites = [];
      entry.satelliteGroup.clear();
    };

    const buildSatellites = (entry: PlanetEntry) => {
      removeSatellites(entry);
      const planetData = propsRef.current.model.planets.find((item) => item.spec.id === entry.spec.id);
      if (!planetData) return;
      for (const chapter of planetData.chapters) {
        const holder = new THREE.Group();
        holder.position.copy(satelliteLocal(chapter, satTime()));
        const size = satelliteSize(chapter, entry.spec);
        const modelGroup = chapter.kind === "natural" ? makeMoon(chapter) : makeCraft(chapter, entry.spec);
        if (chapter.kind === "natural" && chapter.moon) {
          /* Vệ tinh được thu theo tỉ lệ đã cap để không vượt tầm với hành tinh. */
          modelGroup.scale.setScalar(size / Math.max(chapter.moon.radius, 0.001));
        }
        holder.add(modelGroup);
        const hit = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(size * 1.35, 0.06), 10, 8),
          new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        hit.userData = { kind: "chapter", planetId: entry.spec.id, chapterId: chapter.id, title: chapter.title };
        holder.add(hit);
        const stationGroup = new THREE.Group();
        holder.add(stationGroup);
        entry.satelliteGroup.add(holder);

        const orbitLine = circleLine(chapter.orbitRadius, chapter.kind === "natural" ? 0x8fb4d8 : 0xb8c7e0, 0.18);
        orbitLine.visible = false;
        entry.root.add(orbitLine);

        const label = document.createElement("div");
        label.className = `solar-label solar-label-moon ${chapter.kind === "artificial" ? "is-craft" : ""}`;
        const title = document.createElement("span");
        title.textContent = chapter.title;
        const meta = document.createElement("em");
        meta.textContent = `${chapter.kind === "natural" ? "Vệ tinh tự nhiên" : "Vệ tinh nhân tạo"} · ${chapter.visited}/${chapter.total}`;
        label.append(title, meta);
        label.style.display = "none";
        labelsHost.appendChild(label);

        entry.satellites.push({
          chapter,
          holder,
          model: modelGroup,
          hit,
          size,
          orbitLine,
          spin: 0.15 + (chapter.phase % 1) * 0.25,
          label,
          stationGroup,
          stationHits: [],
          stationVisitedKey: "",
        });
      }
    };

    const applyDetail = (entry: PlanetEntry, detail: Detail) => {
      if (entry.detail === detail) return;
      const textures = planetTextures(entry.spec.id, detail);
      entry.material.map = textures.map;
      entry.material.bumpMap = textures.bump;
      entry.material.roughnessMap = textures.roughness;
      entry.material.emissiveMap = textures.emissive;
      entry.material.needsUpdate = true;
      if (entry.cloudMaterial && textures.clouds) {
        entry.cloudMaterial.map = textures.clouds;
        entry.cloudMaterial.needsUpdate = true;
      }
      if (entry.ringMaterial && textures.ring) {
        entry.ringMaterial.map = textures.ring;
        entry.ringMaterial.needsUpdate = true;
      }
      entry.detail = detail;
    };

    const scheduleNearDetail = (entry: PlanetEntry) => {
      if (entry.detail === "near" || entry.nearTimer !== null) return;
      entry.nearTimer = window.setTimeout(() => {
        entry.nearTimer = null;
        if (focusRef.current.planetId === entry.spec.id) applyDetail(entry, "near");
      }, 420);
    };

    const applyVisibility = (next: SolarFocus) => {
      const showAll = next.level === "system" || next.level === "world";
      for (const entry of planets) {
        const focused = entry.spec.id === next.planetId;
        entry.root.visible = showAll || focused;
        entry.orbitLine.visible = showAll;
        (entry.orbitLine.material as THREE.LineBasicMaterial).opacity =
          showAll ? (focused ? 0.4 : 0.2) : 0;
        entry.satelliteGroup.visible = showAll || focused;
        for (const satellite of entry.satellites) {
          satellite.holder.visible = showAll || focused;
          satellite.orbitLine.visible = !showAll && focused;
          satellite.label.style.display = "";
          const isCurrent = next.chapterId === satellite.chapter.id;
          satellite.stationGroup.visible = next.level === "chapter" && focused && isCurrent;
        }
        if (focused && next.level === "planet") {
          scheduleNearDetail(entry);
        } else if (entry.detail === "near" && (showAll || next.level === "chapter")) {
          applyDetail(entry, "far");
        }
      }
    };

    const applyFocus = (next: SolarFocus, force = false) => {
      const prev = prevFocusRef.current;
      const changed =
        force ||
        !prev ||
        prev.level !== next.level ||
        prev.planetId !== next.planetId ||
        prev.chapterId !== next.chapterId ||
        (prev.worldId ?? null) !== (next.worldId ?? null);
      if (!changed) return;

      const currentPose: Pose = { position: camera.position.clone(), target: controls.target.clone() };
      // Khi force (đổi inset/resize/re-apply cùng focus) không ghi đè pose đã nhớ:
      // camera lúc đó có thể đang bay giữa chừng về vị trí đích.
      if (prev && !force) {
        if (prev.level === "system") {
          const fit = Math.max(1, 1.04 / Math.max(0.2, camera.aspect));
          memoryRef.current.system = {
            position: currentPose.target.clone().add(currentPose.position.clone().sub(currentPose.target).multiplyScalar(1 / fit)),
            target: currentPose.target,
          };
        }
        if (prev.level === "planet" && prev.planetId) memoryRef.current.planets.set(prev.planetId, currentPose);
        if (prev.level === "chapter" && prev.chapterId) memoryRef.current.chapters.set(prev.chapterId, currentPose);
      }

      if (next.level !== "system" && (!prev || prev.level === "system" || prev.level === "world")) {
        frozenPlanetRef.current = elapsedRef.current;
      }
      if (next.level === "chapter") {
        frozenChapterRef.current = elapsedRef.current;
      }
      focusRef.current = next;
      hoverRef.current = null;
      hoverKeyRef.current = "";
      propsRef.current.onHover(null);

      const active = planets.find((entry) => entry.spec.id === next.planetId) ?? null;
      applyVisibility(next);

      if (next.level === "chapter" && active && next.chapterId) {
        const satellite = active.satellites.find((item) => item.chapter.id === next.chapterId);
        if (satellite) {
          const needsDecor =
            satellite.stationGroup.children.length === 0 ||
            satellite.stationVisitedKey !==
              satellite.chapter.stations.map((station) => `${station.id}:${station.visited ? 1 : 0}`).join("|");
          if (needsDecor) buildStationDecor(active, satellite);
        }
      }

      refreshPickables();

      // Ánh sáng riêng cho Sao Thổ để vành đổ bóng lên hành tinh.
      const saturn = planets.find((entry) => entry.spec.id === "saturn") ?? null;
      const saturnFocused = next.planetId === "saturn" && (next.level === "planet" || next.level === "chapter") && saturn !== null;
      saturnSpot.visible = saturnFocused;
      saturnSpot.intensity = saturnFocused ? 2.1 : 0;
      pointLight.intensity = saturnFocused ? 0.85 : 2.35;
      fillLight.intensity = next.level === "chapter" ? 0.95 : next.level === "planet" ? 0.2 : next.level === "world" ? 0.35 : 0.1;
      if (saturnFocused && saturn) {
        saturnSpot.target = saturn.root;
        saturnSpot.target.updateMatrixWorld();
      }

      let pose: Pose;
      if (next.level === "system") {
        const base = memoryRef.current.system ?? SYSTEM_POSE;
        const fit = Math.max(1, 1.04 / Math.max(0.2, camera.aspect));
        pose = {
          position: base.target.clone().add(base.position.clone().sub(base.target).multiplyScalar(fit)),
          target: base.target.clone(),
        };
      } else if (next.level === "world") {
        const entry = worlds.find((item) => item.spec.id === next.worldId);
        pose = entry ? worldPose(entry) : SYSTEM_POSE;
      } else if (next.level === "planet") {
        const entry = planets.find((item) => item.spec.id === next.planetId);
        if (!entry) {
          pose = SYSTEM_POSE;
        } else if (prev?.level === "chapter" && prev.planetId === next.planetId) {
          pose = memoryRef.current.planets.get(entry.spec.id) ?? planetPose(entry);
        } else {
          pose = planetPose(entry);
        }
      } else {
        const entry = planets.find((item) => item.spec.id === next.planetId);
        const satellite = entry?.satellites.find((item) => item.chapter.id === next.chapterId);
        if (!entry || !satellite) {
          pose = entry ? planetPose(entry) : SYSTEM_POSE;
        } else {
          const remembered = memoryRef.current.chapters.get(satellite.chapter.id);
          pose =
            !force && remembered && prev?.chapterId === satellite.chapter.id
              ? remembered
              : chapterPose(entry, satellite);
        }
      }
      setPose(pose);
      prevFocusRef.current = next;
    };

    bundle.applyFocus = applyFocus;

    /* Góc nhìn thẳng từ trên xuống cho chế độ nền: trọn tầm với mọi hành tinh. */
    const topDownPose = (): Pose => {
      const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
      const distance = Math.max(
        SCENE_EXTENT / tanHalf,
        SCENE_EXTENT / (tanHalf * Math.max(0.4, camera.aspect))
      ) * 1.04;
      return {
        position: new THREE.Vector3(0, distance, distance * 0.002),
        target: new THREE.Vector3(0, 0, 0),
      };
    };

    bundle.setAmbient = (value) => {
      if (ambientRef.current === value) return;
      ambientRef.current = value;
      labelsHost.style.visibility = value ? "hidden" : "";
      if (value) {
        hoverRef.current = null;
        hoverKeyRef.current = "";
        propsRef.current.onHover(null);
        setPose(topDownPose());
      } else {
        applyFocus(focusRef.current, true);
      }
    };

    bundle.setInset = (value) => {
      const next = Math.max(0, Math.round(value));
      if (next === bundle.inset) return;
      bundle.inset = next;
      resize();
      applyFocus(focusRef.current, true);
    };
    bundle.setInsetY = (value) => {
      const next = Math.max(0, Math.round(value));
      if (next === bundle.insetY) return;
      bundle.insetY = next;
      applyFocus(focusRef.current, true);
    };
    bundle.syncModel = (nextModel) => {
      for (const entry of planets) {
        const data = nextModel.planets.find((item) => item.spec.id === entry.spec.id);
        entry.labelMeta.textContent = data
          ? `${data.subjectLabel} · ${data.chapterCount} chương`
          : entry.spec.subject;
        const fill = entry.labelBar.firstElementChild as HTMLElement | null;
        if (fill) fill.style.width = `${Math.round((data?.progress ?? 0) * 100)}%`;
        entry.label.dataset.chapters = String(data?.chapterCount ?? 0);
        entry.label.dataset.progress = String(Math.round((data?.progress ?? 0) * 100));
        buildSatellites(entry);
        if (data) {
          for (const satellite of entry.satellites) {
            satellite.label.style.display = "";
          }
        }
      }
      const current = focusRef.current;
      applyVisibility(current);
      if (current.level === "chapter" && current.planetId && current.chapterId) {
        const entry = planets.find((item) => item.spec.id === current.planetId);
        const satellite = entry?.satellites.find((item) => item.chapter.id === current.chapterId);
        if (entry && satellite) buildStationDecor(entry, satellite);
      }
      refreshPickables();
    };

    /* --------------------------- tương tác chuột --------------------------- */
    /* Thứ tự chạm: thiên thể nhỏ thắng vành đai. Tia nhìn phải xuyên qua dải đá
       mới tới được hành tinh phòng lab, nên "gần nhất" không phải "được chọn". */
    const HOVER_PRIORITY: SolarHover["kind"][] = [
      "station",
      "chapter",
      "world",
      "planet",
      "sun",
      "belt",
    ];

    const findHover = (): SolarHover | null => {
      if (pointer.x < -1) return null;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickables, false);

      for (const kind of HOVER_PRIORITY) {
        const candidates = hits.filter(
          (item) => (item.object.userData as { kind?: SolarHover["kind"] }).kind === kind
        );
        const hit = candidates[0];
        if (!hit) continue;
        const data = hit.object.userData as {
          kind?: SolarHover["kind"];
          planetId?: PlanetId;
          chapterId?: string;
          stationId?: string;
          title?: string;
        };

        if (kind === "sun") {
          return {
            kind: "sun",
            planetId: null,
            chapterId: null,
            stationId: null,
            title: "AZ AI",
            meta: "Trợ lý học tập trung tâm",
          };
        }
        if (kind === "belt") {
          return {
            kind: "belt",
            planetId: null,
            chapterId: null,
            stationId: null,
            title: "Vành đai đánh giá",
            meta: "Kiểm tra · luyện đề · sửa bài",
          };
        }
        if (kind === "world") {
          const world = worlds.find((item) => item.hit === hit.object);
          if (!world) continue;
          return {
            kind: "world",
            planetId: null,
            chapterId: null,
            stationId: null,
            worldId: world.spec.id,
            title: world.spec.name,
            meta: `${world.spec.designation} · ${world.spec.latin}`,
          };
        }
        if (kind === "planet") {
          const entry = planets.find((item) => item.spec.id === data.planetId);
          const planetData = propsRef.current.model.planets.find((item) => item.spec.id === data.planetId);
          if (!entry) continue;
          return {
            kind: "planet",
            planetId: entry.spec.id,
            chapterId: null,
            stationId: null,
            title: entry.spec.name,
            meta: planetData
              ? `${planetData.subjectLabel} · ${planetData.chapterCount} chương · ${Math.round(planetData.progress * 100)}%`
              : entry.spec.subject,
          };
        }
        if (kind === "chapter") {
          const entry = planets.find((item) => item.spec.id === data.planetId);
          const chapter = entry?.satellites.find((item) => item.chapter.id === data.chapterId)?.chapter;
          if (!chapter) continue;
          return {
            kind: "chapter",
            planetId: data.planetId ?? null,
            chapterId: chapter.id,
            stationId: null,
            title: chapter.title,
            meta: `${chapter.kind === "natural" ? "Vệ tinh tự nhiên" : "Vệ tinh nhân tạo"} · ${chapter.visited}/${chapter.total} trạm`,
          };
        }
        if (kind === "station") {
          const entry = planets.find((item) => item.spec.id === data.planetId);
          const chapter = entry?.satellites.find((item) => item.chapter.id === data.chapterId)?.chapter;
          const station = chapter?.stations.find((item) => item.id === data.stationId);
          if (!station) continue;
          return {
            kind: "station",
            planetId: data.planetId ?? null,
            chapterId: data.chapterId ?? null,
            stationId: station.id,
            title: station.label,
            meta: station.visited ? "Đã học · mở lại bài" : "Trạm học chưa mở",
          };
        }
      }
      return null;
    };

    const updateHover = () => {
      const hover = findHover();
      const key = hover
        ? `${hover.kind}:${hover.planetId}:${hover.chapterId}:${hover.stationId}:${hover.worldId ?? ""}`
        : "";
      hoverRef.current = hover
        ? { kind: hover.kind, planetId: hover.planetId, chapterId: hover.chapterId }
        : null;
      host.style.cursor = hover ? "pointer" : dragging ? "grabbing" : "grab";
      if (key !== hoverKeyRef.current) {
        hoverKeyRef.current = key;
        propsRef.current.onHover(hover);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      bundle.width = rect.width;
      bundle.height = rect.height;
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      updateHover();
    };

    const onPointerDown = (event: PointerEvent) => {
      downPoint = { x: event.clientX, y: event.clientY };
      dragging = true;
      host.style.cursor = "grabbing";
    };

    const onPointerUp = (event: PointerEvent) => {
      const start = downPoint;
      downPoint = null;
      dragging = false;
      if (!start) return;
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > 6) {
        updateHover();
        return;
      }
      const hover = findHover();
      if (!hover) {
        updateHover();
        return;
      }
      if (hover.kind === "belt") {
        propsRef.current.onOpenBelt?.();
      } else if (hover.kind === "world" && hover.worldId) {
        propsRef.current.onFocus({
          level: "world",
          planetId: null,
          chapterId: null,
          worldId: hover.worldId,
        });
      } else if (hover.kind === "sun") {
        propsRef.current.onOpenSun();
      } else if (hover.kind === "planet" && hover.planetId) {
        propsRef.current.onFocus({ level: "planet", planetId: hover.planetId, chapterId: null });
      } else if (hover.kind === "chapter" && hover.planetId && hover.chapterId) {
        propsRef.current.onFocus({ level: "chapter", planetId: hover.planetId, chapterId: hover.chapterId });
      } else if (hover.kind === "station" && hover.planetId && hover.chapterId && hover.stationId) {
        const planetData = propsRef.current.model.planets.find((item) => item.spec.id === hover.planetId);
        const chapter = planetData?.chapters.find((item) => item.id === hover.chapterId);
        const station = chapter?.stations.find((item) => item.id === hover.stationId);
        if (chapter && station) propsRef.current.onOpenStation(chapter, station);
      }
      updateHover();
    };

    const onPointerLeave = () => {
      pointer.set(-2, -2);
      if (hoverKeyRef.current !== "") {
        hoverKeyRef.current = "";
        hoverRef.current = null;
        propsRef.current.onHover(null);
      }
      host.style.cursor = "grab";
    };

    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);

    const onContextLost = (event: Event) => {
      event.preventDefault();
      propsRef.current.onFallback();
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      const previousAspect = camera.aspect;
      bundle.width = width;
      bundle.height = height;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(pixelRatio());
      renderer.setSize(width, height, false);
      if (prevFocusRef.current && Math.abs(camera.aspect - previousAspect) > 0.08) {
        if (ambientRef.current) setPose(topDownPose(), true);
        else applyFocus(focusRef.current, true);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    bundle.inset = Math.max(0, propsRef.current.inset);
    bundle.insetY = Math.max(0, propsRef.current.insetY);
    resize();

    const project = (world: THREE.Vector3): { x: number; y: number; visible: boolean } => {
      const vector = world.clone().project(camera);
      const visible =
        vector.z > -1 &&
        vector.z < 1 &&
        Math.abs(vector.x) < 1.16 &&
        Math.abs(vector.y) < 1.16;
      return {
        x: (vector.x * 0.5 + 0.5) * bundle.width,
        y: (-vector.y * 0.5 + 0.5) * bundle.height,
        visible,
      };
    };

    const updateLabels = () => {
      if (ambientRef.current) return;
      const current = focusRef.current;
      const hover = hoverRef.current;
      /* Tên hành tinh / Mặt Trời chỉ hiện khi con trỏ thật sự trỏ vào vật thể. */
      const hoveredPlanetId = hover?.kind === "planet" ? hover.planetId : null;
      const sunHovered = hover?.kind === "sun";
      const minX = bundle.inset - 4;
      const tanHalf = Math.tan(((camera.fov * Math.PI) / 180) / 2);
      const pxPerUnit = (world: THREE.Vector3) =>
        bundle.height / Math.max(0.001, 2 * camera.position.distanceTo(world) * tanHalf);

      const placed: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const place = (x: number, y: number, w: number, h: number): number => {
        for (let attempt = 0; attempt < 7; attempt += 1) {
          const dir = attempt % 2 === 0 ? 1 : -1;
          const ly = y + dir * Math.ceil(attempt / 2) * (h + 4);
          if (ly < h / 2 + 6 || ly > bundle.height - h / 2 - 6) continue;
          const rect = { x1: x - w / 2, y1: ly - h / 2, x2: x + w / 2, y2: ly + h / 2 };
          const hit = placed.some(
            (other) =>
              !(rect.x2 < other.x1 || rect.x1 > other.x2 || rect.y2 < other.y1 || rect.y1 > other.y2)
          );
          if (!hit) {
            placed.push(rect);
            return ly;
          }
        }
        return y;
      };

      const sunPoint = project(new THREE.Vector3(0, 0, 0));
      const sunRadius = 1.5 * pxPerUnit(new THREE.Vector3());

      /* Đọc kích thước mọi nhãn một lần trước khi ghi style: trộn đọc/ghi
         offsetWidth với style.transform mỗi frame sẽ buộc layout lại liên tục. */
      const sizes = new Map<HTMLElement, { w: number; h: number }>();
      const sizeOf = (el: HTMLElement, dw: number, dh: number) => {
        let size = sizes.get(el);
        if (!size) {
          size = { w: el.offsetWidth || dw, h: el.offsetHeight || dh };
          sizes.set(el, size);
        }
        return size;
      };
      for (const entry of planets) {
        sizeOf(entry.label, 96, 38);
        for (const satellite of entry.satellites) sizeOf(satellite.label, 118, 30);
      }
      sizeOf(sunLabel, 106, 34);

      // Ẩn nhãn vệ tinh trước, chỉ bật vệ tinh thuộc tầng đang xem.
      for (const entry of planets) {
        for (const satellite of entry.satellites) satellite.label.style.opacity = "0";
      }

      // Vẽ nhãn từ hành tinh ngoài vào trong để hành tinh lớn có chỗ trước.
      for (const entry of [...planets].reverse()) {
        const world = entry.root.position.clone();
        const point = project(world);
        const show =
          current.level === "system" &&
          entry.root.visible &&
          point.visible &&
          point.x > minX &&
          hoveredPlanetId === entry.spec.id;
        if (!show) {
          entry.label.style.opacity = "0";
          continue;
        }
        let dx = point.x - sunPoint.x;
        let dy = point.y - sunPoint.y;
        const len = Math.hypot(dx, dy);
        if (len < 26) {
          dx = 1;
          dy = -0.4;
        }
        const norm = Math.hypot(dx, dy) || 1;
        const offset = entry.spec.radius * pxPerUnit(world) + 15;
        const labelX = clamp(point.x + (dx / norm) * offset, 64, bundle.width - 64);
        const { w, h } = sizeOf(entry.label, 96, 38);
        const labelY = clamp(
          place(labelX, point.y + (dy / norm) * offset, w, h),
          h / 2 + 8,
          bundle.height - h / 2 - 8
        );
        entry.label.style.opacity = "1";
        entry.label.style.transform = `translate3d(${labelX}px, ${labelY}px, 0) translate(-50%, -50%)`;
      }

      // Nhãn Mặt Trời đặt sau cùng để không đẩy nhãn các hành tinh ra xa.
      if (sunHovered && current.level === "system" && sunPoint.visible) {
        const { w: sunW, h: sunH } = sizeOf(sunLabel, 106, 34);
        const sunY = place(sunPoint.x, sunPoint.y + sunRadius + 10 + sunH / 2, sunW, sunH);
        sunLabel.style.transform = `translate3d(${sunPoint.x}px, ${sunY}px, 0) translate(-50%, -50%)`;
        sunLabel.style.opacity = "1";
      } else {
        sunLabel.style.opacity = "0";
      }

      const focusedEntry = planets.find((item) => item.spec.id === current.planetId) ?? null;
      if (focusedEntry && (current.level === "planet" || current.level === "chapter")) {
        for (const satellite of focusedEntry.satellites) {
          const focused = current.level === "chapter" && current.chapterId === satellite.chapter.id;
          if (current.level === "chapter" && !focused) continue;
          const satWorld = satellite.holder.getWorldPosition(new THREE.Vector3());
          const satPoint = project(satWorld);
          if (!satPoint.visible || !satellite.holder.visible || satPoint.x < minX) continue;
          const satOffset = satellite.size * pxPerUnit(satWorld) + 26;
          const { w: sw, h: sh } = sizeOf(satellite.label, 118, 30);
          const lx = clamp(satPoint.x, bundle.inset + sw / 2 + 10, bundle.width - sw / 2 - 10);
          const ly = clamp(satPoint.y - satOffset, sh + 150, bundle.height - 14);
          satellite.label.style.opacity = "1";
          satellite.label.style.transform = `translate3d(${lx}px, ${ly}px, 0) translate(-50%, -100%)`;
        }
      }
    };

    const pageEl = host.closest(".solar-page");
    let lastRenderAt = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const now = performance.now();
      /* Ngoài trang chủ cảnh này chỉ là nền tĩnh: ~20fps là đủ, đỡ tốn GPU. */
      if (document.hidden) return;
      if (pageEl?.classList.contains("is-ambient") && now - lastRenderAt < 45) return;
      lastRenderAt = now;
      const delta = Math.min((now - clock.last) / 1000, 0.06);
      clock.last = now;
      frame += 1;
      if (!document.hidden) elapsedRef.current += delta;

      const level = focusRef.current.level;
      const orbitClock = level === "system" ? elapsedRef.current : frozenPlanetRef.current;
      const satClock = level === "chapter" ? frozenChapterRef.current : elapsedRef.current;
      const hover = hoverRef.current;

      for (const entry of planets) {
        entry.root.position.copy(planetPosition(entry.spec, orbitClock));
        const spinTarget = entry.spec.spin;
        entry.mesh.rotation.y += delta * spinTarget * 0.16;
        if (entry.clouds) entry.clouds.rotation.y += delta * 0.022;
        if (entry.ring) entry.ring.rotation.z += delta * 0.004;

        const isHovered = hover?.kind === "planet" && hover.planetId === entry.spec.id;
        const scaleTarget = isHovered ? 1.035 : 1;
        const scale = entry.tilt.scale.x + (scaleTarget - entry.tilt.scale.x) * Math.min(1, delta * 9);
        entry.tilt.scale.setScalar(scale);
        const glowTarget = isHovered ? 0.28 : entry.spec.id === "earth" ? 0.4 : 0.015;
        entry.material.emissiveIntensity += (glowTarget - entry.material.emissiveIntensity) * Math.min(1, delta * 8);

        for (const satellite of entry.satellites) {
          satellite.holder.position.copy(satelliteLocal(satellite.chapter, satClock));
          satellite.model.rotation.y += delta * satellite.spin * 0.5;
          const satHovered =
            hover?.kind === "chapter" && hover.chapterId === satellite.chapter.id;
          const target = satHovered ? 1.14 : 1;
          const value = satellite.model.scale.x + (target - satellite.model.scale.x) * Math.min(1, delta * 10);
          satellite.model.scale.setScalar(value);
        }
      }

      sunMesh.rotation.y += delta * 0.02;
      glowInner.material.rotation += delta * 0.01;

      beltGroup.rotation.y += delta * 0.012;
      for (const world of worlds) {
        world.group.position.copy(worldPosition(world.spec, orbitClock));
        world.group.rotation.y += delta * world.spin;
      }
      for (const part of worldSpinners) part.obj.rotation.y += delta * part.speed;
      for (const led of worldBlinkers) {
        const wave = 0.5 + 0.5 * Math.sin(orbitClock * led.speed + led.phase);
        (led.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = led.base * (0.3 + 0.7 * wave);
      }

      if (flight) {
        flight.t = Math.min(1, flight.t + delta / flight.duration);
        const t = easeInOutCubic(flight.t);
        camera.position.lerpVectors(flight.from.position, flight.to.position, t);
        controls.target.lerpVectors(flight.from.target, flight.to.target, t);
        if (flight.t >= 1) {
          flight = null;
          controls.enabled = !ambientRef.current;
        }
      }

      if (ambientRef.current) {
        /* Nền động: quay chậm quanh trục để cảnh không đứng yên ở các trang khác. */
        if (!flight && !reducedMotion) {
          const angle = delta * 0.035;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const x = camera.position.x * cos - camera.position.z * sin;
          const z = camera.position.x * sin + camera.position.z * cos;
          camera.position.x = x;
          camera.position.z = z;
        }
        camera.lookAt(controls.target);
      } else {
        controls.update();
      }

      fillLight.position.copy(camera.position);
      fillLight.target.position.copy(controls.target);
      fillLight.target.updateMatrixWorld();

      if (frame % 2 === 0) updateLabels();
      renderer.render(scene, camera);
    };

    bundleRef.current = bundle;
    animate();
    propsRef.current.onReady();

    const dispose = () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      for (const entry of planets) {
        if (entry.nearTimer !== null) window.clearTimeout(entry.nearTimer);
        removeSatellites(entry);
      }
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material?.dispose();
      });
      labelsHost.innerHTML = "";
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      bundleRef.current = null;
    };
    bundle.dispose = dispose;

    // ký ức camera / focus mặc định được dựng lại sau mỗi lần mount
    prevFocusRef.current = null;
    focusRef.current = propsRef.current.focus;
    if (propsRef.current.focus.level !== "system") {
      frozenPlanetRef.current = elapsedRef.current;
      frozenChapterRef.current = elapsedRef.current;
    }

    return () => {
      dispose();
      prevFocusRef.current = null;
      disposeSolarTextures();
    };
  }, []);

  /* ---------------------- đồng bộ dữ liệu học tập ---------------------- */
  useEffect(() => {
    bundleRef.current?.syncModel(model);
  }, [model]);

  /* -------------------------- đồng bộ điều hướng -------------------------- */
  useEffect(() => {
    bundleRef.current?.applyFocus(focus);
  }, [focus]);

  useEffect(() => {
    bundleRef.current?.setInset(inset);
  }, [inset]);

  useEffect(() => {
    bundleRef.current?.setInsetY(insetY);
  }, [insetY]);

  useEffect(() => {
    bundleRef.current?.setAmbient(Boolean(ambient));
  }, [ambient]);

  return (
    <div className="solar-scene" ref={hostRef}>
      <div className="solar-labels" ref={labelsRef} aria-hidden="true" />
    </div>
  );
}
