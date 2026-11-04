import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import CreateLesson from "./components/CreateLesson";
import Account from "./components/Account";
import Library from "./components/Library";
import { lazy, Suspense } from "react";
import StudyCorner from "./components/StudyCorner";
import LandingHome from "./components/LandingHome";
import SimulationHub from "./components/SimulationHub";
import AssessmentHub from "./components/AssessmentHub";
import Settings from "./components/Settings";
const GeometrySpace = lazy(() => import("./components/GeometrySpace"));
const ChemistryLab = lazy(() => import("./components/ChemistryLab"));
const ArduinoStudio = lazy(() => import("./components/ArduinoStudio"));
/* LessonViewer kéo theo react-markdown + micromark (~200KB) chỉ dùng khi mở bài. */
const LessonViewer = lazy(() => import("./components/LessonViewer"));
import PipelineOverlay from "./components/PipelineOverlay";
import SolarDashboard from "./components/SolarDashboard";
import TopStatus from "./components/TopStatus";
import "./layout.css";
import { AppearanceProvider } from "./palettes";
import { useStore } from "./store";

export default function App() {
  const view = useStore((s) => s.view);
  const activeId = useStore((s) => s.activeId);
  const sceneFade = useStore((s) => s.sceneFade);
  const initAccount = useStore((s) => s.initAccount);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    void initAccount();
  }, [initAccount]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [view, activeId]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="app-shell">
      <AppearanceProvider />
      {/* Nền hệ mặt trời toàn màn hình phía sau toàn bộ web. */}
      <SolarDashboard ambient={view !== "home"} />
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Đóng thanh điều hướng"
          onClick={closeSidebar}
        />
      )}

      <div className="app-main">
        <TopStatus onMenu={() => setSidebarOpen(true)} />

        <main className="app-content" id="main" key={view}>
          {view === "home" && <LandingHome />}
          {view === "library" && <Library />}
          {view === "create" && <CreateLesson />}
          {view === "account" && <Account />}
          {view === "lesson" && activeId && (
            <Suspense fallback={<div className="empty-state"><p>Đang tải bài học…</p></div>}>
              <LessonViewer />
            </Suspense>
          )}
          {view === "lesson" && !activeId && <LandingHome />}
          {view === "study" && <StudyCorner />}
          {view === "sim" && <SimulationHub />}
          {view === "assess" && <AssessmentHub />}
          {view === "settings" && <Settings />}
          {view === "geometry" && (
            <Suspense fallback={<div className="empty-state"><p>Đang tải không gian 3D…</p></div>}>
              <GeometrySpace />
            </Suspense>
          )}
          {view === "lab" && (
            <Suspense fallback={<div className="empty-state"><p>Đang tải phòng lab 3D…</p></div>}>
              <ChemistryLab />
            </Suspense>
          )}
          {view === "arduino" && (
            <Suspense fallback={<div className="empty-state"><p>Đang tải không gian Arduino…</p></div>}>
              <ArduinoStudio />
            </Suspense>
          )}
        </main>
      </div>

      <PipelineOverlay />
      <div className={`scene-fade ${sceneFade ? "is-on" : ""}`} aria-hidden="true" />
    </div>
  );
}
