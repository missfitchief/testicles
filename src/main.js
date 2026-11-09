import "./style.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { mountMedia } from "./media.js";

gsap.registerPlugin(ScrollTrigger);
const chapters = [...document.querySelectorAll("[data-scene]")];
const phone = matchMedia("(max-width:700px)");
const media = mountMedia(chapters, { phone });
const active = new Set();
function choose() {
  const center = innerHeight / 2;
  let nearest = 0,
    distance = Infinity;
  for (const index of active) {
    const box = chapters[index].getBoundingClientRect();
    const gap =
      box.top > center
        ? box.top - center
        : box.bottom < center
          ? center - box.bottom
          : 0;
    if (gap < distance) {
      distance = gap;
      nearest = index;
    }
  }
  media.select(nearest);
}
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const index = chapters.indexOf(entry.target);
      entry.isIntersecting ? active.add(index) : active.delete(index);
    }
    if (active.size) choose();
  },
  { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
);
chapters.forEach((chapter) => observer.observe(chapter));

const motion = gsap.matchMedia();
motion.add("(prefers-reduced-motion: no-preference)", () => {
  gsap.from(".hero h1", { opacity: 0, duration: 0.85, ease: "power3.out" });
  gsap.from(".hero-intro", {
    opacity: 0,
    y: 14,
    duration: 0.7,
    delay: 0.15,
    ease: "power3.out",
  });
  for (const chapter of chapters.slice(1)) {
    gsap.fromTo(
      chapter.querySelector(".scene-visual"),
      { yPercent: 2, scale: 1.025 },
      {
        yPercent: -2,
        scale: 1,
        ease: "none",
        scrollTrigger: {
          trigger: chapter,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      },
    );
    gsap.from(chapter.querySelector(".scene-copy"), {
      opacity: 0,
      y: 24,
      duration: 0.7,
      ease: "power3.out",
      scrollTrigger: {
        trigger: chapter,
        start: "top 60%",
        toggleActions: "play none none reverse",
      },
    });
  }
});
let toastTimer;
document
  .querySelector("[data-copy-contract]")
  .addEventListener("click", async () => {
    const contract = "0x236feecd909ff562e775318c77781f4946c33b3b";
    let success = false;
    try {
      await navigator.clipboard.writeText(contract);
      success = true;
    } catch {
      const input = document.createElement("textarea");
      input.value = contract;
      input.style.cssText = "position:fixed;left:-9999px";
      document.body.append(input);
      input.select();
      success = document.execCommand("copy");
      input.remove();
    }
    const toast = document.querySelector(".toast");
    toast.textContent = success
      ? "Contract copied. The right pair."
      : "Copy failed. Please try again.";
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  });
document.fonts.ready.then(() => ScrollTrigger.refresh());
window.addEventListener("pagehide", (event) => {
  media.pause();
  if (!event.persisted) {
    media.dispose();
    observer.disconnect();
    motion.revert();
    clearTimeout(toastTimer);
  }
});
window.addEventListener("pageshow", () => media.resume());
