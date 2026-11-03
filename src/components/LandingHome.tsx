import { useEffect } from "react";
import WelcomeSection from "./WelcomeSection";

/**
 * Trang chủ cuộn: hero trong suốt cho thấy nền hệ mặt trời toàn màn hình,
 * cuộn xuống mới thấy phần trang chủ (thống kê + lưới môn học).
 */
export default function LandingHome() {
  useEffect(() => {
    const scroller = document.querySelector<HTMLElement>(".home-scroll");
    const page = document.querySelector<HTMLElement>(".solar-page");
    if (!scroller || !page) return;
    // Khi đã cuộn qua hero, ẩn HUD 2D của hệ mặt trời để không đè lên nội dung.
    const sync = () => page.classList.toggle("is-away", scroller.scrollTop > 48);
    sync();
    scroller.addEventListener("scroll", sync, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", sync);
      page.classList.remove("is-away");
    };
  }, []);

  return (
    <div className="home-scroll">
      <section className="home-hero" aria-hidden="true" />
      <WelcomeSection />
    </div>
  );
}
