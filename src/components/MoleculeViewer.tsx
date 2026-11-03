import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { FlaskConical, RotateCcw, Tags } from "lucide-react";

/* ==========================================================================
   ChemLab 3D — phòng thí nghiệm phân tử, dựng bằng Three.js.
   Bố cục kính: danh sách phân tử bên trái, sân khấu 3D bên phải.
   ========================================================================== */

const ATOM_COLORS: Record<string, number> = {
  H: 0xf6f8ff,
  C: 0x4b5064,
  N: 0x3050f8,
  O: 0xff3b3b,
  F: 0x90e050,
  Cl: 0x1fd15f,
  Na: 0xab5cf2,
  Mg: 0x8aff00,
  S: 0xffff30,
  P: 0xff8000,
  K: 0x8f40d4,
  Ca: 0x3dff00,
  Fe: 0xe06633,
  Cu: 0xc88033,
  Zn: 0x7d80b0,
  Ag: 0xc0c0c0,
  Au: 0xffd123,
  Br: 0xa62929,
  I: 0x940094,
  He: 0xd9ffff,
};

const ATOM_RADII: Record<string, number> = {
  H: 0.3,
  C: 0.5,
  N: 0.45,
  O: 0.45,
  F: 0.4,
  Cl: 0.6,
  Na: 0.9,
  Mg: 0.8,
  S: 0.6,
  P: 0.55,
  K: 1,
  Ca: 0.9,
  Fe: 0.7,
  Cu: 0.7,
  Zn: 0.7,
  Ag: 0.8,
  Au: 0.8,
  Br: 0.65,
  I: 0.75,
};

type Pt = [number, number, number];

interface Molecule {
  name: string;
  formula: string;
  info: string;
  atoms: { el: string; pos: Pt }[];
  bonds: [number, number][];
}

const MOLECULES: Molecule[] = [
  {
    name: "Nước",
    formula: "H₂O",
    info: "Góc liên kết ~104,5°, phân tử có cực. Nhiệt độ sôi 100°C ở áp suất chuẩn.",
    atoms: [
      { el: "O", pos: [0, 0, 0] },
      { el: "H", pos: [0.76, 0.59, 0] },
      { el: "H", pos: [-0.76, 0.59, 0] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
    ],
  },
  {
    name: "Carbon dioxide",
    formula: "CO₂",
    info: "Phân tử thẳng, góc 180°. Là khí nhà kính, tham gia quang hợp.",
    atoms: [
      { el: "C", pos: [0, 0, 0] },
      { el: "O", pos: [1.16, 0, 0] },
      { el: "O", pos: [-1.16, 0, 0] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
    ],
  },
  {
    name: "Methane",
    formula: "CH₄",
    info: "Hình tứ diện đều, góc ~109,5°. Thành phần chính của khí tự nhiên.",
    atoms: [
      { el: "C", pos: [0, 0, 0] },
      { el: "H", pos: [0.89, 0.89, 0.89] },
      { el: "H", pos: [-0.89, -0.89, 0.89] },
      { el: "H", pos: [-0.89, 0.89, -0.89] },
      { el: "H", pos: [0.89, -0.89, -0.89] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ],
  },
  {
    name: "Ammonia",
    formula: "NH₃",
    info: "Hình chóp tam giác, góc ~107°. Mùi hắc, nguyên liệu sản xuất phân bón.",
    atoms: [
      { el: "N", pos: [0, 0, 0] },
      { el: "H", pos: [0.94, 0.38, 0] },
      { el: "H", pos: [-0.47, 0.38, 0.81] },
      { el: "H", pos: [-0.47, 0.38, -0.81] },
    ],
    bonds: [
      [0, 1],
      [0, 2],
      [0, 3],
    ],
  },
  {
    name: "Ethanol",
    formula: "C₂H₅OH",
    info: "Rượu ethylic, dùng trong đồ uống, dung môi và sát khuẩn y tế.",
    atoms: [
      { el: "C", pos: [0, 0, 0] },
      { el: "C", pos: [1.5, 0, 0] },
      { el: "O", pos: [2.3, 0.9, 0] },
      { el: "H", pos: [2.9, 1.2, 0] },
      { el: "H", pos: [-0.5, 0.9, 0] },
      { el: "H", pos: [-0.5, -0.5, 0.8] },
      { el: "H", pos: [-0.5, -0.5, -0.8] },
      { el: "H", pos: [1.5, -0.9, 0.5] },
      { el: "H", pos: [1.5, -0.9, -0.5] },
    ],
    bonds: [
      [0, 1],
      [1, 2],
      [2, 3],
      [0, 4],
      [0, 5],
      [0, 6],
      [1, 7],
      [1, 8],
    ],
  },
  {
    name: "Benzene",
    formula: "C₆H₆",
    info: "Vòng sáu cạnh với hệ liên kết cộng hưởng. Dung môi hữu cơ quan trọng.",
    atoms: [
      { el: "C", pos: [1.4, 0, 0] },
      { el: "C", pos: [0.7, 1.21, 0] },
      { el: "C", pos: [-0.7, 1.21, 0] },
      { el: "C", pos: [-1.4, 0, 0] },
      { el: "C", pos: [-0.7, -1.21, 0] },
      { el: "C", pos: [0.7, -1.21, 0] },
      { el: "H", pos: [2.48, 0, 0] },
      { el: "H", pos: [1.25, 2.17, 0] },
      { el: "H", pos: [-1.25, 2.17, 0] },
      { el: "H", pos: [-2.48, 0, 0] },
      { el: "H", pos: [-1.25, -2.17, 0] },
      { el: "H", pos: [1.25, -2.17, 0] },
    ],
    bonds: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 0],
      [0, 6],
      [1, 7],
      [2, 8],
      [3, 9],
      [4, 10],
      [5, 11],
    ],
  },
  {
    name: "Glucose",
    formula: "C₆H₁₂O₆",
    info: "Đường đơn giản, nguồn năng lượng chính của tế bào sống.",
    atoms: [
      { el: "C", pos: [0, 0, 0] },
      { el: "C", pos: [1.5, 0, 0] },
      { el: "C", pos: [2.2, 1.2, 0] },
      { el: "O", pos: [1.5, 2.0, 0] },
      { el: "C", pos: [0, 1.5, 0] },
      { el: "O", pos: [-0.8, 0.8, 0] },
      { el: "H", pos: [-0.5, -0.8, 0] },
      { el: "H", pos: [1.5, -0.8, 0.5] },
      { el: "H", pos: [2.8, 1.8, 0] },
      { el: "H", pos: [0.5, 2.2, 0] },
    ],
    bonds: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [0, 5],
      [0, 6],
      [1, 7],
      [2, 8],
      [4, 9],
    ],
  },
];

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export default function ChemistryLab() {
  const [active, setActive] = useState(0);
  const [labelsOn, setLabelsOn] = useState(true);
  const [resetKey, setResetKey] = useState(0);

  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const labelRendererRef = useRef<CSS2DRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  const molecule = MOLECULES[active];
  const elements = useMemo(
    () => [...new Set(molecule.atoms.map((atom) => atom.el))],
    [molecule]
  );

  // Khởi tạo scene một lần
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(6.2, 4.6, 6.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.className = "chem-canvas";
    host.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = "chem-labels";
    host.appendChild(labelRenderer.domElement);
    labelRendererRef.current = labelRenderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.2;
    controls.maxDistance = 22;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(8, 12, 10);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xaab8ff, 1.2);
    rim.position.set(-9, -4, -8);
    scene.add(rim);
    const glow = new THREE.PointLight(0x8b5cf6, 1.4, 30);
    glow.position.set(-4, 6, 4);
    scene.add(glow);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      labelRenderer.setSize(width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
    };
  }, []);

  // Dựng phân tử đang chọn
  useEffect(() => {
    const group = groupRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!group || !camera || !controls) return;

    while (group.children.length) {
      const child = group.children.pop();
      if (!child) continue;
      child.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
          else node.material.dispose();
        }
        if (node instanceof CSS2DObject) node.element.remove();
      });
    }

    const positions = molecule.atoms.map((atom) => new THREE.Vector3(...atom.pos));
    const maxRadius = positions.reduce(
      (max, position) => Math.max(max, position.length()),
      1
    );
    const scale = 2.15 / maxRadius;
    group.scale.setScalar(scale);

    const bondMaterial = new THREE.MeshStandardMaterial({
      color: 0x9aa6c8,
      roughness: 0.42,
      metalness: 0.15,
    });

    molecule.atoms.forEach((atom) => {
      const radius = ATOM_RADII[atom.el] ?? 0.5;
      const color = ATOM_COLORS[atom.el] ?? 0x8a8f9e;
      const geometry = new THREE.SphereGeometry(radius, 36, 36);
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.32,
        metalness: 0.06,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...atom.pos);
      group.add(mesh);

      const label = document.createElement("div");
      label.className = "chem-label";
      label.textContent = atom.el;
      const object = new CSS2DObject(label);
      object.position.set(0, radius + 0.12 / scale, 0);
      object.visible = labelsOn;
      mesh.add(object);
    });

    molecule.bonds.forEach(([from, to]) => {
      const a = positions[from];
      const b = positions[to];
      if (!a || !b) return;
      const direction = new THREE.Vector3().subVectors(b, a);
      const length = direction.length();
      const geometry = new THREE.CylinderGeometry(0.075, 0.075, length, 14);
      const mesh = new THREE.Mesh(geometry, bondMaterial);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize()
      );
      group.add(mesh);
    });

    camera.position.set(6.2, 4.6, 6.8);
    controls.target.set(0, 0, 0);
    controls.update();

    return () => {
      bondMaterial.dispose();
    };
  }, [molecule, labelsOn, resetKey]);

  return (
    <div className="lab-workspace">
      <aside className="chem-panel">
        <header className="chem-head">
          <span className="chem-mark">
            <FlaskConical size={17} />
          </span>
          <div>
            <strong>MÔ HÌNH PHÂN TỬ</strong>
            <span>CHỌN PHÂN TỬ · XOAY 3D</span>
          </div>
        </header>

        <div className="chem-scroll">
          <div className="chem-section-title">PHÂN TỬ MẪU</div>
          <div className="chem-list">
            {MOLECULES.map((item, index) => (
              <button
                key={item.formula}
                type="button"
                className={`chem-mol ${index === active ? "is-active" : ""}`}
                onClick={() => setActive(index)}
                aria-pressed={index === active}
              >
                <span className="chem-formula">{item.formula}</span>
                <span className="chem-name">{item.name}</span>
              </button>
            ))}
          </div>

          <div className="chem-section-title">THÔNG TIN PHÂN TỬ</div>
          <div className="chem-info">
            <div className="chem-info-formula">{molecule.formula}</div>
            <div className="chem-info-name">{molecule.name}</div>
            <p>{molecule.info}</p>
            <div className="chem-stats">
              <span>{molecule.atoms.length} NGUYÊN TỬ</span>
              <span>{molecule.bonds.length} LIÊN KẾT</span>
            </div>
          </div>

          <div className="chem-section-title">CHÚ THÍCH NGUYÊN TỬ</div>
          <div className="chem-legend">
            {elements.map((element) => (
              <span key={element} className="chem-legend-item">
                <i style={{ background: hex(ATOM_COLORS[element] ?? 0x8a8f9e) }} />
                {element}
              </span>
            ))}
          </div>
        </div>
      </aside>

      <section className="chem-stage">
        <div ref={hostRef} className="chem-host" aria-label="Mô hình phân tử 3D" />
        <div className="chem-overlay">
          <button
            type="button"
            className="chem-tool"
            onClick={() => setResetKey((value) => value + 1)}
          >
            <RotateCcw size={13} /> ĐẶT LẠI
          </button>
          <button
            type="button"
            className={`chem-tool ${labelsOn ? "is-on" : ""}`}
            onClick={() => setLabelsOn((value) => !value)}
            aria-pressed={labelsOn}
          >
            <Tags size={13} /> NHÃN
          </button>
        </div>
        <div className="chem-hint">KÉO CHUỘT TRÁI: XOAY · LĂN: ZOOM · CHUỘT PHẢI: PAN</div>
      </section>
    </div>
  );
}
