import type { SavedLesson } from "./storage";
import { fold } from "./subjects";

/* ==========================================================================
   AZTEACH · SOLAR SYSTEM — lớp dữ liệu
   Tách phần "thiên văn" (PlanetSpec) khỏi phần "học tập" (SavedLesson).
   Không hardcode số chương / vệ tinh: mọi thứ suy ra từ kho bài học.
   ========================================================================== */

export type PlanetId =
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

export type MoonKind = "moon" | "europa" | "io" | "titan" | "phobos" | "triton";

export interface MoonSpec {
  id: string;
  name: string;
  kind: MoonKind;
  radius: number;
  seed: number;
}

export interface PlanetSpec {
  id: PlanetId;
  order: number;
  name: string;
  latin: string;
  subject: string;
  aliases: string[];
  radius: number;
  orbit: number;
  orbitSpeed: number;
  spin: number;
  tilt: number;
  phase: number;
  atmosphere: string;
  atmosphereIntensity: number;
  ring?: { inner: number; outer: number; opacity: number };
  moons: MoonSpec[];
}

export const PLANETS: PlanetSpec[] = [
  {
    id: "mercury",
    order: 1,
    name: "Sao Thuỷ",
    latin: "Mercury",
    subject: "Tin học",
    aliases: ["tin hoc", "tin học", "may tinh", "máy tính", "lap trinh", "lập trình", "computer", "code", "cong nghe", "công nghệ"],
    radius: 0.32,
    orbit: 3.3,
    orbitSpeed: 0.082,
    spin: 0.55,
    tilt: 0.03,
    phase: 0.4,
    atmosphere: "#8d8a84",
    atmosphereIntensity: 0.12,
    moons: [],
  },
  {
    id: "venus",
    order: 2,
    name: "Sao Kim",
    latin: "Venus",
    subject: "Ngữ Văn & Ngoại ngữ",
    aliases: ["ngu van", "ngữ văn", "van hoc", "văn học", "literature", "tieng anh", "tiếng anh", "english", "ngoai ngu", "ngoại ngữ", "ngon ngu", "ngôn ngữ"],
    radius: 0.5,
    orbit: 4.6,
    orbitSpeed: 0.061,
    spin: -0.24,
    tilt: 2.64,
    phase: 2.1,
    atmosphere: "#e8c47a",
    atmosphereIntensity: 0.4,
    moons: [],
  },
  {
    id: "earth",
    order: 3,
    name: "Trái Đất",
    latin: "Earth",
    subject: "Sinh học",
    aliases: ["sinh hoc", "sinh học", "sinh ly", "sinh lý", "biology", "sinh"],
    radius: 0.5,
    orbit: 6.0,
    orbitSpeed: 0.047,
    spin: 0.72,
    tilt: 0.41,
    phase: 4.2,
    atmosphere: "#5ba9ff",
    atmosphereIntensity: 0.6,
    moons: [{ id: "moon", name: "Mặt Trăng", kind: "moon", radius: 0.22, seed: 71 }],
  },
  {
    id: "mars",
    order: 4,
    name: "Sao Hoả",
    latin: "Mars",
    subject: "Lịch sử",
    aliases: ["lich su", "lịch sử", "history", "su"],
    radius: 0.4,
    orbit: 7.5,
    orbitSpeed: 0.038,
    spin: 0.7,
    tilt: 0.44,
    phase: 5.7,
    atmosphere: "#d2764a",
    atmosphereIntensity: 0.22,
    moons: [
      { id: "phobos", name: "Phobos", kind: "phobos", radius: 0.16, seed: 12 },
      { id: "deimos", name: "Deimos", kind: "moon", radius: 0.11, seed: 33 },
    ],
  },
  {
    id: "jupiter",
    order: 5,
    name: "Sao Mộc",
    latin: "Jupiter",
    subject: "Vật lý",
    aliases: ["vat ly", "vật lý", "vat li", "vật lí", "physics", "ly", "lí"],
    radius: 1.15,
    orbit: 10.4,
    orbitSpeed: 0.027,
    spin: 1.1,
    tilt: 0.05,
    phase: 1.2,
    atmosphere: "#d8b98d",
    atmosphereIntensity: 0.26,
    moons: [
      { id: "io", name: "Io", kind: "io", radius: 0.27, seed: 5 },
      { id: "europa", name: "Europa", kind: "europa", radius: 0.24, seed: 8 },
      { id: "ganymede", name: "Ganymede", kind: "moon", radius: 0.34, seed: 19 },
      { id: "callisto", name: "Callisto", kind: "moon", radius: 0.32, seed: 27 },
    ],
  },
  {
    id: "saturn",
    order: 6,
    name: "Sao Thổ",
    latin: "Saturn",
    subject: "Toán học",
    aliases: ["toan", "toán", "math", "mathematics", "dai so", "đại số", "hinh hoc", "hình học", "giai tich", "giải tích"],
    radius: 0.98,
    orbit: 13.1,
    orbitSpeed: 0.02,
    spin: 1.0,
    tilt: 0.47,
    phase: 3.4,
    atmosphere: "#e3ceA4",
    atmosphereIntensity: 0.3,
    ring: { inner: 1.4, outer: 2.2, opacity: 0.95 },
    moons: [
      { id: "titan", name: "Titan", kind: "titan", radius: 0.34, seed: 3 },
      { id: "rhea", name: "Rhea", kind: "moon", radius: 0.21, seed: 44 },
      { id: "enceladus", name: "Enceladus", kind: "europa", radius: 0.16, seed: 52 },
      { id: "iapetus", name: "Iapetus", kind: "moon", radius: 0.19, seed: 63 },
    ],
  },
  {
    id: "uranus",
    order: 7,
    name: "Sao Thiên Vương",
    latin: "Uranus",
    subject: "Địa lý",
    aliases: ["dia ly", "địa lý", "dia li", "địa lí", "geography", "trai dat", "trái đất"],
    radius: 0.66,
    orbit: 15.5,
    orbitSpeed: 0.0155,
    spin: -0.5,
    tilt: 1.71,
    phase: 0.9,
    atmosphere: "#a4e0e6",
    atmosphereIntensity: 0.42,
    ring: { inner: 1.5, outer: 1.78, opacity: 0.3 },
    moons: [
      { id: "titania", name: "Titania", kind: "moon", radius: 0.24, seed: 6 },
      { id: "oberon", name: "Oberon", kind: "moon", radius: 0.22, seed: 15 },
      { id: "ariel", name: "Ariel", kind: "europa", radius: 0.18, seed: 24 },
      { id: "umbriel", name: "Umbriel", kind: "moon", radius: 0.18, seed: 31 },
    ],
  },
  {
    id: "neptune",
    order: 8,
    name: "Sao Hải Vương",
    latin: "Neptune",
    subject: "Hoá học",
    aliases: ["hoa hoc", "hoá học", "hóa học", "chemistry", "hoa", "hóa", "hoá"],
    radius: 0.64,
    orbit: 17.8,
    orbitSpeed: 0.0125,
    spin: 0.62,
    tilt: 0.49,
    phase: 2.7,
    atmosphere: "#4d7dff",
    atmosphereIntensity: 0.5,
    moons: [
      { id: "triton", name: "Triton", kind: "triton", radius: 0.22, seed: 9 },
      { id: "proteus", name: "Proteus", kind: "phobos", radius: 0.15, seed: 22 },
    ],
  },
];

export const PLANET_BY_ID: Record<PlanetId, PlanetSpec> = PLANETS.reduce(
  (acc, planet) => {
    acc[planet.id] = planet;
    return acc;
  },
  {} as Record<PlanetId, PlanetSpec>
);

/* ------------------------------- Hình học --------------------------------
   "Tầm với" của một hành tinh = bán kính thân, vành đai, hoặc quỹ đạo vệ tinh
   ngoài cùng. Quỹ đạo được giãn theo tầm với để không thiên thể nào chạm nhau. */
export const SATELLITE_LANES = 3;

export function satelliteOrbitRadius(planet: PlanetSpec, lane: number): number {
  return planet.radius * (1.35 + lane * 0.16) + 0.08;
}

export function satelliteRenderSize(planet: PlanetSpec, moonRadius?: number | null): number {
  const craft = Math.min(Math.max(planet.radius * 0.17, 0.055), 0.16);
  const raw = moonRadius ? Math.min(moonRadius, planet.radius * 0.42) : craft;
  return Math.min(raw, planet.radius * 0.3);
}

export function planetReach(planet: PlanetSpec): number {
  const ring = planet.ring ? planet.radius * planet.ring.outer : 0;
  const biggestMoon = planet.moons.reduce((max, moon) => Math.max(max, moon.radius), 0);
  const satellites =
    satelliteOrbitRadius(planet, SATELLITE_LANES - 1) + satelliteRenderSize(planet, biggestMoon);
  return Math.max(planet.radius * 1.14, ring, satellites);
}

const ORBIT_GAP = 0.6;
const BELT_WIDTH = 5.6;
const BELT_CLEARANCE = 0.55;

(function layoutOrbits() {
  let cursor = 2.9;
  PLANETS[0].orbit = cursor;
  for (let i = 1; i < PLANETS.length; i += 1) {
    const prev = PLANETS[i - 1];
    const current = PLANETS[i];
    let gap = planetReach(prev) + planetReach(current) + ORBIT_GAP;
    /* Chừa nguyên một dải rộng cho vành đai tiểu hành tinh sau Sao Hoả. */
    if (current.id === "jupiter") gap += BELT_WIDTH + BELT_CLEARANCE * 2;
    cursor += gap;
    current.orbit = cursor;
  }
})();

const MARS_SPEC = PLANET_BY_ID.mars;

export const BELT = {
  inner: MARS_SPEC.orbit + planetReach(MARS_SPEC) + BELT_CLEARANCE,
  get outer() {
    return this.inner + BELT_WIDTH;
  },
  get center() {
    return (this.inner + this.outer) / 2;
  },
};

export const SCENE_EXTENT = PLANETS.reduce(
  (max, planet) => Math.max(max, planet.orbit + planetReach(planet)),
  0
);

export type SatelliteKind = "natural" | "artificial";
export type CraftVariant = "comms" | "observer" | "telescope" | "probe";

export interface SolarStation {
  /** Khoá duy nhất trong localStorage, ví dụ "lessonId#3" */
  id: string;
  label: string;
  blockIndex: number;
  tab: "lecture" | "quiz";
  visited: boolean;
}

export interface SolarChapter {
  id: string;
  lessonId: string;
  title: string;
  kind: SatelliteKind;
  moon: MoonSpec | null;
  craft: CraftVariant;
  orbitRadius: number;
  phase: number;
  speed: number;
  stations: SolarStation[];
  total: number;
  visited: number;
  progress: number;
  done: boolean;
}

export interface SolarPlanet {
  spec: PlanetSpec;
  subjects: string[];
  subjectLabel: string;
  lessons: SavedLesson[];
  chapters: SolarChapter[];
  chapterCount: number;
  stationCount: number;
  visited: number;
  progress: number;
  active: boolean;
  mastered: boolean;
}

export interface SolarModel {
  planets: SolarPlanet[];
  chapters: number;
  stations: number;
  visited: number;
  progress: number;
  unmapped: number;
}

export type SolarLevel = "system" | "planet" | "chapter" | "world";

export interface SolarFocus {
  level: SolarLevel;
  planetId: PlanetId | null;
  chapterId: string | null;
  /** Thế giới phòng lab trong vành đai, chỉ dùng khi level === "world". */
  worldId?: string | null;
}

export const SYSTEM_FOCUS: SolarFocus = {
  level: "system",
  planetId: null,
  chapterId: null,
  worldId: null,
};

/* --------------------------------------------------------------------------
   Tiến độ — localStorage, tách khỏi dữ liệu bài học
   -------------------------------------------------------------------------- */

const PROGRESS_KEY = "solar-progress-v1";
type ProgressMap = Record<string, string[]>;

export function loadSolarProgress(): ProgressMap {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const clean: ProgressMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) clean[key] = value.filter((item) => typeof item === "string");
    }
    return clean;
  } catch {
    return {};
  }
}

function saveSolarProgress(map: ProgressMap) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

export function markStationVisited(lessonId: string, stationId: string) {
  const map = loadSolarProgress();
  const list = map[lessonId] ?? [];
  if (!list.includes(stationId)) {
    map[lessonId] = [...list, stationId];
    saveSolarProgress(map);
  }
}

export function markLessonVisited(lessonId: string, stations: SolarStation[]) {
  const map = loadSolarProgress();
  const list = new Set(map[lessonId] ?? []);
  for (const station of stations) list.add(station.id);
  map[lessonId] = [...list];
  saveSolarProgress(map);
}

export function clearSolarProgress() {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // ignore
  }
}

/* --------------------------------------------------------------------------
   Suy ra chương / trạm học từ SavedLesson
   -------------------------------------------------------------------------- */

function stationLabel(text: string, fallback: string): string {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length > 64 ? `${clean.slice(0, 61)}…` : clean;
}

function buildStations(lesson: SavedLesson, visitedSet: Set<string>): SolarStation[] {
  const stations: SolarStation[] = [];
  let headingIndex = 0;
  lesson.blocks.forEach((block, index) => {
    if (block.type !== "heading" || block.level > 2) return;
    headingIndex += 1;
    const id = `${lesson.id}#h${index}`;
    stations.push({
      id,
      label: stationLabel(block.text, `Phần ${headingIndex}`),
      blockIndex: index,
      tab: "lecture",
      visited: visitedSet.has(id),
    });
  });

  if (stations.length === 0) {
    const id = `${lesson.id}#start`;
    stations.push({
      id,
      label: "Bài giảng",
      blockIndex: 0,
      tab: "lecture",
      visited: visitedSet.has(id),
    });
  }

  if (Array.isArray(lesson.quiz) && lesson.quiz.length > 0) {
    const id = `${lesson.id}#quiz`;
    stations.push({
      id,
      label: "Luyện tập",
      blockIndex: -1,
      tab: "quiz",
      visited: visitedSet.has(id),
    });
  }

  return stations.slice(0, 7);
}

const CRAFTS: CraftVariant[] = ["comms", "observer", "telescope", "probe"];

function chapterFor(
  planet: PlanetSpec,
  lesson: SavedLesson,
  index: number,
  visitedSet: Set<string>
): SolarChapter {
  const natural = planet.moons.length > 0 && (index === 0 || index % 3 === 0);
  const moon = natural ? planet.moons[Math.min(index, planet.moons.length - 1)] : null;
  const stations = buildStations(lesson, visitedSet);
  const visited = stations.filter((station) => station.visited).length;
  const lane = index % 3;
  return {
    id: lesson.id,
    lessonId: lesson.id,
    title: stationLabel(lesson.topic, "Chương chưa đặt tên"),
    kind: natural ? "natural" : "artificial",
    moon,
    craft: CRAFTS[index % CRAFTS.length],
    orbitRadius: satelliteOrbitRadius(planet, lane),
    phase: index * 2.399 + planet.order * 0.7,
    speed: (0.32 + lane * 0.06) * (index % 2 === 0 ? 1 : -1),
    stations,
    total: stations.length,
    visited,
    progress: stations.length ? visited / stations.length : 0,
    done: stations.length > 0 && visited === stations.length,
  };
}

/* --------------------------------------------------------------------------
   Ghép môn học thật vào hành tinh
   -------------------------------------------------------------------------- */

export function solarModel(lessons: SavedLesson[]): SolarModel {
  const progress = loadSolarProgress();
  const bySubject = new Map<string, SavedLesson[]>();

  for (const lesson of lessons) {
    const subject = String(lesson.subject || "Khác").trim() || "Khác";
    const list = bySubject.get(subject) ?? [];
    list.push(lesson);
    bySubject.set(subject, list);
  }

  const used = new Set<string>();
  const assigned = new Map<PlanetId, string[]>();

  for (const planet of PLANETS) {
    const matches: string[] = [];
    for (const subject of bySubject.keys()) {
      if (used.has(subject)) continue;
      const key = fold(subject);
      const hit = planet.aliases.some((alias) => key === fold(alias) || key.includes(fold(alias)));
      if (hit) {
        matches.push(subject);
        used.add(subject);
      }
    }
    assigned.set(planet.id, matches);
  }

  // Môn chưa khớp (hoặc môn mới người dùng tạo) rơi vào hành tinh còn trống.
  const leftovers = [...bySubject.keys()].filter((subject) => !used.has(subject));
  if (leftovers.length > 0) {
    const empty = PLANETS.find((planet) => (assigned.get(planet.id) ?? []).length === 0);
    if (empty) {
      assigned.set(empty.id, leftovers);
      for (const subject of leftovers) used.add(subject);
    }
  }

  const planets: SolarPlanet[] = PLANETS.map((spec) => {
    const subjects = assigned.get(spec.id) ?? [];
    const subjectLessons = subjects.flatMap((subject) => bySubject.get(subject) ?? []);
    const sorted = [...subjectLessons].sort((a, b) => {
      const at = typeof a.createdAt === "number" ? a.createdAt : Date.parse(String(a.createdAt)) || 0;
      const bt = typeof b.createdAt === "number" ? b.createdAt : Date.parse(String(b.createdAt)) || 0;
      return at - bt;
    });
    const chapters = sorted.map((lesson, index) => {
      const visitedSet = new Set(progress[lesson.id] ?? []);
      return chapterFor(spec, lesson, index, visitedSet);
    });
    const stationCount = chapters.reduce((sum, chapter) => sum + chapter.total, 0);
    const visited = chapters.reduce((sum, chapter) => sum + chapter.visited, 0);
    const progressValue = stationCount ? visited / stationCount : 0;
    return {
      spec,
      subjects,
      subjectLabel: subjects.length > 1 ? `${spec.subject} · ${subjects.length} môn` : spec.subject,
      lessons: sorted,
      chapters,
      chapterCount: chapters.length,
      stationCount,
      visited,
      progress: progressValue,
      active: chapters.length > 0 && progressValue < 1,
      mastered: stationCount > 0 && progressValue >= 0.999,
    };
  });

  const stationCount = planets.reduce((sum, planet) => sum + planet.stationCount, 0);
  const visited = planets.reduce((sum, planet) => sum + planet.visited, 0);

  return {
    planets,
    chapters: planets.reduce((sum, planet) => sum + planet.chapterCount, 0),
    stations: stationCount,
    visited,
    progress: stationCount ? visited / stationCount : 0,
    unmapped: [...bySubject.keys()].filter((subject) => !used.has(subject)).length,
  };
}

export function planetById(model: SolarModel, id: PlanetId | null): SolarPlanet | null {
  if (!id) return null;
  return model.planets.find((planet) => planet.spec.id === id) ?? null;
}

export function chapterById(
  model: SolarModel,
  planetId: PlanetId | null,
  chapterId: string | null
): SolarChapter | null {
  const planet = planetById(model, planetId);
  if (!planet || !chapterId) return null;
  return planet.chapters.find((chapter) => chapter.id === chapterId) ?? null;
}

export function percent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

/* Mã màu nhận diện cho từng hành tinh, dùng đồng bộ giữa cảnh 3D và giao diện 2D. */
export const PLANET_ACCENT: Record<PlanetId, string> = {
  mercury: "#b8b2a6",
  venus: "#e8c47a",
  earth: "#5ba9ff",
  mars: "#d2764a",
  jupiter: "#d8b98d",
  saturn: "#e3cea4",
  uranus: "#a4e0e6",
  neptune: "#4d7dff",
};
