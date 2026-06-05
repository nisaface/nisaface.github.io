// ── Navbar dropdown ───────────────────────────────────────────
const hamburger = document.getElementById("nav-hamburger");
const navLinks = document.getElementById("nav-links");

if (hamburger && navLinks) {
  hamburger.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = hamburger.getAttribute("aria-expanded") === "true";
    hamburger.setAttribute("aria-expanded", String(!open));
    navLinks.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#site-nav")) {
      navLinks.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      navLinks.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
      hamburger.focus();
    }
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      hamburger.setAttribute("aria-expanded", "false");
    });
  });

  const hero = document.getElementById("chapter-hero");
  const whiteBar = document.getElementById("white-bar");

  if (hero && whiteBar) {
    window.addEventListener("scroll", () => {
      const heroBottom = hero.offsetTop + hero.offsetHeight;
      const scrolled = window.scrollY;
      const fadeStart = heroBottom * 0.2;
      const fadeEnd = heroBottom * 0.6;
      const opacity = Math.max(
        0,
        1 - (scrolled - fadeStart) / (fadeEnd - fadeStart),
      );
      hero.style.opacity = opacity;
    });
  }
}
