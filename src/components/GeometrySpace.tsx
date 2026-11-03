import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RotateCcw } from "lucide-react";



const DEFAULT_FREE = `# Tự do: mỗi dòng là 1 điểm "Nhãn x y z" hoặc 1 cạnh "Nhãn1 Nhãn2"
A 0 0 0
B 2 0 0
C 2 2 0
D 0 2 0
S 1 1 3
A B
B C
C D
D A
S A
S B
S C
S D`;

interface Pt3 { x: number; y: number; z: number }

function parseFree(text: string): { points: Map<string, Pt3>; edges: [string, string][] } {
  const points = new Map<string, Pt3>();
  const edges: [string, string][] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    if (parts.length === 4) {
      const [label, xs, ys, zs] = parts;
      const x = Number(xs), y = Number(ys), z = Number(zs);
      if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) points.set(label, { x, y, z });
    } else if (parts.length === 2 && !Number.isFinite(Number(parts[0])) && !Number.isFinite(Number(parts[1]))) {
      edges.push([parts[0], parts[1]]);
    }
  }
  return { points, edges };
}

export default function GeometrySpace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const objectsRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const dragPointRef = useRef<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [freeText, setFreeText] = useState(DEFAULT_FREE);
  const [wireframe, setWireframe] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [tool, setTool] = useState<string>("select");
  const [selectedPts, setSelectedPts] = useState<string[]>([]);

  // GeoGebra command bar
  const [cmdInput, setCmdInput] = useState("");
  const [cmdError, setCmdError] = useState("");
  const [cmdPoints, setCmdPoints] = useState<Map<string, Pt3>>(new Map());
  const [cmdEdges, setCmdEdges] = useState<{ a: string; b: string }[]>([]);
  const [cmdPolys, setCmdPolys] = useState<string[][]>([]);
  const [cmdSolids, setCmdSolids] = useState<{ type: string; params: number[]; center: Pt3 }[]>([]);
  const [cmdLog, setCmdLog] = useState<string[]>(["# Gõ lệnh rồi Enter. Ví dụ: A = (1,2,3)  Segment(A,B)  Cube(O,2)"]);

  // Init scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(6, 6, 6);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controlsRef.current = controls;

    const group = new THREE.Group();
    scene.add(group);
    objectsRef.current = group;

    const grid = new THREE.GridHelper(60, 60, 0xcccccc, 0xe8e8e8);
    grid.name = "grid";
    scene.add(grid);

    const axes = new THREE.AxesHelper(5);
    axes.name = "axes";
    scene.add(axes);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    let raf = 0;
    const animate = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(animate); };
    animate();

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  // Toggle grid/axes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const grid = scene.getObjectByName("grid");
    const axes = scene.getObjectByName("axes");
    if (grid) grid.visible = showGrid;
    if (axes) axes.visible = showAxes;
  }, [showGrid, showAxes]);

  // Rebuild geometry
  useEffect(() => {
    const group = objectsRef.current;
    if (!group) return;
    while (group.children.length) group.remove(group.children[0]);

    const lineMat = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
    const pointMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });


    // Free mode (default) - always render free text construction
    const fp = parseFree(freeText);
    for (const [, pt] of fp.points) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), pointMat);
      s.position.set(pt.x, pt.y, pt.z);
      group.add(s);
    }
    const freeEdgePts: number[] = [];
    for (const [la, lb] of fp.edges) {
      const pa = fp.points.get(la), pb = fp.points.get(lb);
      if (pa && pb) freeEdgePts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
    if (freeEdgePts.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(freeEdgePts, 3));
      group.add(new THREE.LineSegments(g, lineMat));
    }

    // Command objects
    for (const [label, pt] of cmdPoints) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), new THREE.MeshBasicMaterial({ color: 0x1a1a1a }));
      s.position.set(pt.x, pt.y, pt.z);
      s.userData.label = label;
      group.add(s);
    }
    const edgePts: number[] = [];
    for (const e of cmdEdges) {
      const pa = cmdPoints.get(e.a), pb = cmdPoints.get(e.b);
      if (pa && pb) edgePts.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
    }
    if (edgePts.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(edgePts, 3));
      group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x1a1a1a })));
    }
    for (const poly of cmdPolys) {
      const pts = poly.map((l) => cmdPoints.get(l)).filter(Boolean) as Pt3[];
      if (pts.length < 3) continue;
      const verts: number[] = [];
      for (const p of pts) verts.push(p.x, p.y, p.z);
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      g.setIndex(Array.from({ length: pts.length - 2 }, (_: unknown, i: number) => [0, i + 1, i + 2]).flat());
      group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xcccccc, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })));
      const lp: number[] = [];
      for (const p of pts) lp.push(p.x, p.y, p.z);
      lp.push(pts[0].x, pts[0].y, pts[0].z);
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(lp, 3));
      group.add(new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x1a1a1a })));
    }
    for (const s of cmdSolids) {
      const { type, params, center } = s;
      const r = params[0] || 1, h = params[1] || r;
      let mesh: THREE.Mesh | null = null;
      if (type === "cube") mesh = new THREE.Mesh(new THREE.BoxGeometry(r, r, r), new THREE.MeshStandardMaterial({ color: 0xcccccc, wireframe }));
      else if (type === "sphere") mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), new THREE.MeshStandardMaterial({ color: 0xcccccc, wireframe }));
      else if (type === "cylinder") mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), new THREE.MeshStandardMaterial({ color: 0xcccccc, wireframe }));
      else if (type === "cone") mesh = new THREE.Mesh(new THREE.ConeGeometry(r, h, 16), new THREE.MeshStandardMaterial({ color: 0xcccccc, wireframe }));
      else if (type === "pyramid") mesh = new THREE.Mesh(new THREE.ConeGeometry(r / Math.sqrt(2), h, 4), new THREE.MeshStandardMaterial({ color: 0xcccccc, wireframe }));
      if (mesh) { mesh.position.set(center.x, center.y, center.z); group.add(mesh); }
    }
  }, [wireframe, freeText, cmdPoints, cmdEdges, cmdPolys, cmdSolids]);

  // Command bar
  const runCmd = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd || cmd.startsWith("#")) return;
    setCmdError("");
    const log = (msg: string) => setCmdLog((prev) => [...prev.slice(-30), msg]);
    let m = cmd.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)$/);
    if (m) { const [, label, xs, ys, zs] = m; setCmdPoints((prev) => new Map(prev).set(label, { x: Number(xs), y: Number(ys), z: Number(zs) })); log(`✓ Điểm ${label} = (${xs}, ${ys}, ${zs})`); return; }
    m = cmd.match(/^Segment\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/i);
    if (m) { setCmdEdges((prev) => [...prev, { a: m![1], b: m![2] }]); log(`✓ Đoạn ${m![1]}${m![2]}`); return; }
    m = cmd.match(/^Line\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/i);
    if (m) { setCmdEdges((prev) => [...prev, { a: m![1], b: m![2] }]); log(`✓ Đường thẳng ${m![1]}${m![2]}`); return; }
    m = cmd.match(/^Vector\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/i);
    if (m) { setCmdEdges((prev) => [...prev, { a: m![1], b: m![2] }]); log(`✓ Véc-tơ ${m![1]}${m![2]}`); return; }
    m = cmd.match(/^Polygon\s*\(([^)]+)\)$/i);
    if (m) { const labels = m![1].split(",").map((s) => s.trim()).filter(Boolean); if (labels.length >= 3) { setCmdPolys((prev) => [...prev, labels]); log(`✓ Đa giác ${labels.join("")}`); return; } }
    m = cmd.match(/^Plane\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/i);
    if (m) { setCmdPolys((prev) => [...prev, [m![1], m![2], m![3]]]); log(`✓ Mặt phẳng ${m![1]}${m![2]}${m![3]}`); return; }
    m = cmd.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*Midpoint\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)$/i);
    if (m) {
      const [, label, a, b] = m;
      const pa = cmdPoints.get(a), pb = cmdPoints.get(b);
      if (pa && pb) { setCmdPoints((prev) => new Map(prev).set(label, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 })); log(`✓ Trung điểm ${label} của ${a}${b}`); return; }
      setCmdError(`Chưa có điểm ${!pa ? a : b}.`); return;
    }
    m = cmd.match(/^(Cube|Sphere|Cylinder|Cone|Pyramid)\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)\s*,\s*(-?[\d.]+)(?:\s*,\s*(-?[\d.]+))?\s*\)$/i);
    if (m) {
      const type = m![1].toLowerCase();
      const centerLabel = m![2];
      const center = cmdPoints.get(centerLabel) || { x: 0, y: 0, z: 0 };
      const params = [Number(m![3])];
      if (m![4] !== undefined) params.push(Number(m![4]));
      setCmdSolids((prev) => [...prev, { type, params, center }]);
      log(`✓ ${m![1]} tại ${centerLabel}`);
      return;
    }
    setCmdError(`Không nhận lệnh: "${cmd}". Xem ví dụ bên dưới.`);
    setCmdLog((prev) => [...prev.slice(-30), `✗ ${cmd}`]);
  };

  const clearCmd = () => {
    setCmdPoints(new Map());
    setCmdEdges([]);
    setCmdPolys([]);
    setCmdSolids([]);
    setCmdLog(["# Đã xoá toàn bộ."]);
    setCmdError("");
  };

  const resetView = () => { controlsRef.current?.reset(); };



  // Drag and drop points
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const camera = cameraRef.current!;
    raycasterRef.current.setFromCamera(mouse, camera);
    const intersects = raycasterRef.current.intersectObjects(objectsRef.current!.children, true);
    const pointHit = intersects.find((i) => i.object.userData.label);
    if (pointHit) {
      dragPointRef.current = pointHit.object.userData.label;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragPointRef.current) return;
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const camera = cameraRef.current!;
    raycasterRef.current.setFromCamera(mouse, camera);
    const pt = cmdPoints.get(dragPointRef.current);
    if (!pt) return;
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).negate(), new THREE.Vector3(pt.x, pt.y, pt.z));
    const intersection = new THREE.Vector3();
    if (raycasterRef.current.ray.intersectPlane(plane, intersection)) {
      setCmdPoints((prev) => {
        const next = new Map(prev);
        next.set(dragPointRef.current!, { x: Math.round(intersection.x), y: Math.round(intersection.y), z: Math.round(intersection.z) });
        return next;
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointRef.current) {
      const label = dragPointRef.current;
      setCmdPoints((prev) => {
        const pt = prev.get(label);
        if (!pt) return prev;
        const next = new Map(prev);
        next.set(label, { x: Math.round(pt.x), y: Math.round(pt.y), z: Math.round(pt.z) });
        return next;
      });
      dragPointRef.current = null;
      return;
    }
    // Click handling for construction tools
    const canvas = rendererRef.current?.domElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dx = e.clientX - (dragStartRef.current?.x ?? e.clientX);
    const dy = e.clientY - (dragStartRef.current?.y ?? e.clientY);
    const wasClick = Math.hypot(dx, dy) < 5;
    if (!wasClick) return;
    // Determine point label (existing or new)
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const camera = cameraRef.current!;
    raycasterRef.current.setFromCamera(mouse, camera);
    const intersects = raycasterRef.current.intersectObjects(objectsRef.current!.children, true);
    const pointHit = intersects.find((i) => i.object.userData.label);
    let label: string;
    if (pointHit) {
      label = pointHit.object.userData.label;
    } else {
      // place new point on ground plane
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersection = new THREE.Vector3();
      if (!raycasterRef.current.ray.intersectPlane(groundPlane, intersection)) return;
      label = `P${cmdPoints.size + selectedPts.length + 1}`;
      setCmdPoints((prev) => {
        const next = new Map(prev);
        next.set(label, { x: Math.round(intersection.x), y: 0, z: Math.round(intersection.z) });
        return next;
      });
    }

    if (tool === "select" || tool === "point") {
      // point tool just places; select does nothing extra
      return;
    }

    // Accumulate selected points
    const newSelected = [...selectedPts, label];
    const required: Record<string, number> = {
      segment: 2, line: 2, ray: 2, midpoint: 2,
      triangle: 3, quadrilateral: 4, plane: 3, bisector: 3,
    };
    const need = required[tool] || 2;
    if (newSelected.length < need) {
      setSelectedPts(newSelected);
      return;
    }
    // Create object
    if (tool === "segment" || tool === "line" || tool === "ray") {
      setCmdEdges((prev) => [...prev, { a: newSelected[0], b: newSelected[1] }]);
    } else if (tool === "midpoint") {
      const pa = cmdPoints.get(newSelected[0]) || (cmdPoints.get(newSelected[0]));
      const pb = cmdPoints.get(newSelected[1]);
      if (pa && pb) {
        const mLabel = `M${cmdPoints.size + 1}`;
        setCmdPoints((prev) => new Map(prev).set(mLabel, { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 }));
      }
    } else if (tool === "triangle" || tool === "quadrilateral") {
      setCmdPolys((prev) => [...prev, newSelected]);
    } else if (tool === "plane") {
      setCmdPolys((prev) => [...prev, newSelected.slice(0, 3)]);
    } else if (tool === "bisector") {
      // angle bisector: points [A, vertex, C] -> ray from vertex
      const A = cmdPoints.get(newSelected[0]);
      const V = cmdPoints.get(newSelected[1]);
      const C = cmdPoints.get(newSelected[2]);
      if (A && V && C) {
        const v1 = { x: A.x - V.x, y: A.y - V.y, z: A.z - V.z };
        const v2 = { x: C.x - V.x, y: C.y - V.y, z: C.z - V.z };
        const n1 = Math.hypot(v1.x, v1.y, v1.z) || 1;
        const n2 = Math.hypot(v2.x, v2.y, v2.z) || 1;
        const d = { x: v1.x / n1 + v2.x / n2, y: v1.y / n1 + v2.y / n2, z: v1.z / n1 + v2.z / n2 };
        const dn = Math.hypot(d.x, d.y, d.z) || 1;
        const far = { x: V.x + (d.x / dn) * 3, y: V.y + (d.y / dn) * 3, z: V.z + (d.z / dn) * 3 };
        const bLabel = `B${cmdPoints.size + 1}`;
        setCmdPoints((prev) => new Map(prev).set(bLabel, far));
        setCmdEdges((prev) => [...prev, { a: newSelected[1], b: bLabel }]);
      }
    }
    setSelectedPts([]);
  };

  return (
    <div className="geometry-space">
      <header className="page-head">
        <div>
          <span className="kicker">HÌNH HỌC KHÔNG GIAN</span>
          <h1>Mô phỏng 3D (Three.js)</h1>
        </div>
        <div className="page-head-meta">
          <button type="button" className="btn btn-ghost" onClick={resetView}>
            <RotateCcw size={14} /> Đặt lại góc nhìn
          </button>
        </div>
      </header>

      <div className="cmd-bar">
        <input
          type="text"
          className="cmd-input"
          value={cmdInput}
          onChange={(e) => setCmdInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { runCmd(cmdInput); setCmdInput(""); } }}
          placeholder="Gõ lệnh: A = (1,2,3)  Segment(A,B)  Cube(O,2)  Sphere(O,1) ..."
          spellCheck={false}
        />
        <button type="button" className="btn btn-primary" onClick={() => { runCmd(cmdInput); setCmdInput(""); }}>
          Thực hiện
        </button>
        <button type="button" className="btn btn-ghost" onClick={clearCmd}>
          Xoá hết
        </button>
      </div>
      {cmdError && <div className="cmd-error">{cmdError}</div>}
      {cmdLog.length > 0 && (
        <div className="cmd-log">
          {cmdLog.map((line, i) => (
            <div key={i} className={line.startsWith("✗") ? "cmd-log-err" : "cmd-log-ok"}>{line}</div>
          ))}
        </div>
      )}

      <div className="geometry-layout">
        <aside className="geometry-controls">
          <div className="panel">
            <div className="panel-head">
              <span className="kicker">CÔNG CỤ</span>
              <h3 className="panel-title">Xây dựng hình</h3>
            </div>
            <div className="tool-list">
              {[
                { id: "select", label: "Chọn / Di chuyển" },
                { id: "point", label: "Điểm" },
                { id: "segment", label: "Đoạn thẳng" },
                { id: "line", label: "Đường thẳng" },
                { id: "ray", label: "Tia" },
                { id: "midpoint", label: "Trung điểm" },
                { id: "bisector", label: "Tia phân giác" },
                { id: "triangle", label: "Tam giác" },
                { id: "quadrilateral", label: "Tứ giác" },
                { id: "plane", label: "Mặt phẳng" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tool-btn ${tool === t.id ? "is-active" : ""}`}
                  onClick={() => { setTool(t.id); setSelectedPts([]); }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {selectedPts.length > 0 && (
              <p className="geometry-hint">
                Đã chọn {selectedPts.length} điểm: {selectedPts.join(", ")}
              </p>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="kicker">TỰ DO</span>
              <h3 className="panel-title">Theo đề bài của bạn</h3>
            </div>
            <textarea
              className="free-text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              spellCheck={false}
            />
            <p className="geometry-hint">
              Mỗi dòng: <code>Nhãn x y z</code> (điểm) hoặc <code>Nhãn1 Nhãn2</code> (cạnh). Dòng bắt đầu bằng # là ghi chú.
            </p>
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="kicker">HIỂN THỊ</span>
              <h3 className="panel-title">Tuỳ chọn</h3>
            </div>
            <div className="toggle-list">
              <label className="toggle-row">
                <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                <span>Lưới</span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={showAxes} onChange={(e) => setShowAxes(e.target.checked)} />
                <span>Trục tọa độ</span>
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} />
                <span>Khung dây</span>
              </label>
            </div>
            <p className="geometry-hint">
              Kéo chuột để xoay · Lăn để zoom · Click điểm để kéo · Click khoảng trống để đặt điểm.
            </p>
          </div>
        </aside>

        <div
          className="geometry-canvas-wrap"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div ref={containerRef} className="geometry-canvas" />
        </div>
      </div>
    </div>
  );
}
