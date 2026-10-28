// ── Viewport ──────────────────────────────────────────────────
const isMobile = window.innerWidth < 768;
const isMobileLandscape =
  window.innerWidth < 900 && window.innerHeight < window.innerWidth;

// iOS Safari: size sticky stages to the visible viewport, minus the sticky nav
// they sit under (they're pinned at top: var(--nav-height)).
// Called before the map is created so the container starts at the right height.
let lastStageHeight = 0;
function setStageHeight() {
  const navHeight =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue("--nav-height"),
    ) || 75;
  const viewport = window.visualViewport
    ? window.visualViewport.height
    : window.innerHeight;
  const h = Math.round(viewport - navHeight);
  if (h === lastStageHeight) return;
  lastStageHeight = h;
  document
    .querySelectorAll("#jeep-stage, #paper-stage, #sticky-map")
    .forEach((stage) => (stage.style.height = h + "px"));
}

setStageHeight();
window.addEventListener("resize", setStageHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", setStageHeight);
}

// ── Views ─────────────────────────────────────────────────────
const DEFAULT_VIEW = {
  center: isMobileLandscape
    ? [137.5, 36.5]
    : isMobile
      ? [127.5, 35.5]
      : [130.5, 37.68],
  zoom: isMobile ? 4.5 : 5.5,
  pitch: 0,
  bearing: 0,
  duration: 1200,
};
const PUSAN_VIEW = { center: [129.25, 35.1], zoom: 10, pitch: 60, duration: 1500 };
const KOJEDO_VIEW = { center: [129, 34.87], zoom: 11, pitch: 60, duration: 1500 };

// ── Map ───────────────────────────────────────────────────────
const map = new maplibregl.Map({
  container: "map",
  cooperativeGestures: true,
  style: {
    version: 8,
    glyphs: "fonts/{fontstack}/{range}.pbf",
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "#dfdede" },
      },
    ],
  },
  center: DEFAULT_VIEW.center,
  zoom: DEFAULT_VIEW.zoom,
  minZoom: isMobile ? 4 : 5.5,
  maxZoom: 7,
  renderWorldCopies: false,
  maxBounds: [
    [119.0, 32.0],
    [142.0, 44.0],
  ],
});

map.addControl(new maplibregl.NavigationControl(), "top-left");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

// ── Popups ────────────────────────────────────────────────────
const POPUP_FIELDS = [
  { key: "Type", label: "" },
  { key: "Name_1", label: "Compound:" },
  { key: "Capacity", label: "Capacity:" },
  { key: "Population", label: "Population:" },
];

const hasValue = (v) => v !== undefined && v !== null && v !== "";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function facilityPopup(props) {
  const overCapacity =
    props.Capacity && Number(props.Population) > Number(props.Capacity);

  const rows = POPUP_FIELDS.filter((f) => hasValue(props[f.key]))
    .map((f) => {
      const val = escapeHtml(props[f.key]);
      const valueStyle =
        f.key === "Population" && overCapacity
          ? "padding:2px 0;color:#cc0000;font-weight:700;"
          : "padding:2px 0";
      return f.label === ""
        ? `<tr><td colspan="2" style="${valueStyle}">${val}</td></tr>`
        : `<tr><td style="color:#666;padding:2px 8px 2px 0;white-space:nowrap">${f.label}</td><td style="${valueStyle}">${val}</td></tr>`;
    })
    .join("");

  return `
  <div style="font-weight:700;margin-bottom:8px;">${escapeHtml(props.Name || "")}</div>
  <table style="font-size:12px;border-collapse:collapse">${rows}</table>
`;
}

let activePopup = null;
let locationPopupsEnabled = true;

function closePopup() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}

function attachPopup(layerId, { popupFn = facilityPopup, enabled = () => true } = {}) {
  map.on("mouseenter", layerId, (e) => {
    if (!enabled() || !e.features.length) return;
    const feature = e.features[0];
    map.getCanvas().style.cursor = "pointer";
    const coords =
      feature.geometry.type === "Point"
        ? feature.geometry.coordinates.slice()
        : e.lngLat;
    closePopup();
    activePopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    })
      .setLngLat(coords)
      .setHTML(popupFn(feature.properties))
      .addTo(map);
  });
  map.on("mouseleave", layerId, () => {
    map.getCanvas().style.cursor = "";
    closePopup();
  });
}

// ── Symbol images ─────────────────────────────────────────────
// Drawn at 2x and registered with pixelRatio 2 so icons stay crisp on retina.
const ICON_PIXEL_RATIO = 2;

function addSymbolImage(name, drawFn, size = 24) {
  const px = size * ICON_PIXEL_RATIO;
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  ctx.scale(ICON_PIXEL_RATIO, ICON_PIXEL_RATIO);
  drawFn(ctx, size);
  const imageData = ctx.getImageData(0, 0, px, px);
  map.addImage(
    name,
    { width: px, height: px, data: imageData.data },
    { pixelRatio: ICON_PIXEL_RATIO },
  );
}

function drawCross(color) {
  return (ctx, s) => {
    const t = s * 0.13;
    ctx.fillStyle = "#000000";
    ctx.fillRect(s / 2 - t / 2 - 1, 0, t + 2, s);
    ctx.fillRect(0, s / 2 - t / 2 - 1, s, t + 2);
    ctx.fillStyle = color;
    ctx.fillRect(s / 2 - t / 2, 1, t, s - 2);
    ctx.fillRect(1, s / 2 - t / 2, s - 2, t);
  };
}

function drawSquareEpw(ctx, s) {
  ctx.strokeStyle = "#ff0000";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(2, 2, s - 4, s - 4);
  ctx.fillStyle = "#000000";
  ctx.fillRect(3, 3, s - 6, s - 6);
}

function drawTriangleEpw(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(s / 2, 2);
  ctx.lineTo(s - 2, s - 2);
  ctx.lineTo(2, s - 2);
  ctx.closePath();
  ctx.strokeStyle = "#ff0000";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#000000";
  ctx.fill();
}

function drawPusanHighlight(ctx, s) {
  const c = s / 2;
  const circle = (r, color) => {
    ctx.beginPath();
    ctx.arc(c, c, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  circle(s / 2 - 1, "#ffffff");
  circle(s / 2 - 1.25, "#ff6600");
  circle(1.6, "#000000");
}

// ── Scrolly illustrations ─────────────────────────────────────
// Each .illus-step can list the frames it shows: data-frames="1 2 3"
// (values match each frame's data-frame). A step without it shows blank paper.
// Nothing carries over between steps, so the result is the same whichever
// direction the reader scrolls in.
function initIllustrationScroller(stepsSelector, framesSelector, hooks = {}) {
  const container = document.querySelector(stepsSelector);
  if (!container) return;

  const frames = [...document.querySelectorAll(framesSelector)];
  const steps = [...container.querySelectorAll(".illus-step")];

  function showFrames(stepEl) {
    const wanted = new Set(
      (stepEl?.dataset.frames || "").split(/\s+/).filter(Boolean),
    );
    frames.forEach((f) =>
      f.classList.toggle("active", wanted.has(f.dataset.frame)),
    );
  }

  const scroller = scrollama();
  scroller
    .setup({ step: stepsSelector + " .illus-step", offset: 0.5 })
    .onStepEnter(({ element, direction }) => {
      showFrames(element);
      hooks.onEnter?.(Number(element.dataset.step), direction);
    })
    .onStepExit(({ element, direction, index }) => {
      // Remove if nothing in the HTML/CSS adds this class.
      element.classList.remove("overlay-active");
      hooks.onExit?.(direction);

      if (direction !== "up") return;

      // Scrolling back above the first step clears everything;
      // otherwise fall back to the previous step's frames.
      const prev = index > 0 ? steps[index - 1] : null;
      showFrames(prev);
      if (prev) hooks.onBackTo?.(Number(prev.dataset.step));
      else hooks.onReset?.();
    });

  window.addEventListener("resize", scroller.resize);
}

function createJeepOverlayController() {
  const ids = ["jeep-overlay", "jeep-overlay-2", "jeep-overlay-3", "jeep-overlay-4"];
  let maxStep = -1;
  let enteredFromBelow = false;

  const apply = (step) =>
    ids.forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.style.opacity = step >= i + 1 ? "1" : "0";
    });

  return {
    onEnter(step, direction) {
      if (direction === "down") {
        maxStep = Math.max(maxStep, step);
        enteredFromBelow = false;
        apply(maxStep);
      } else {
        apply(enteredFromBelow ? maxStep : step);
      }
    },
    onExit(direction) {
      if (direction === "down") enteredFromBelow = true;
    },
    onReset() {
      maxStep = -1;
      enteredFromBelow = false;
      apply(-1);
    },
    onBackTo(prevStep) {
      apply(enteredFromBelow ? maxStep : prevStep);
      if (prevStep <= 0) enteredFromBelow = false;
    },
  };
}

initIllustrationScroller("#jeep-steps", ".jeep-frame", createJeepOverlayController());
initIllustrationScroller("#illustration-steps", ".illustration-frame");

// ── Map steps ─────────────────────────────────────────────────
const EPW = ["epw-facilities", "epw-branch-camps"];

const KOJEDO_FILTERS = {
  "epw-facilities": ["!", ["in", ["get", "Name"], ["literal", ["Koje-do"]]]],
  "epw-branch-camps": [
    "!",
    ["in", ["get", "Name"], ["literal", ["Chogu-ri", "Yoncho-do", "Pongam-do"]]],
  ],
};

const STEPS = {
  0: { layers: ["japanese-colonial-prisons"], northFill: "#ffffff" },
  1: { layers: ["national-prisons-1946"], locationPopups: true },
  2: { layers: ["national-prisons-1946", "national-prison-populations-1946"] },
  3: { layers: EPW, view: DEFAULT_VIEW },
  4: { layers: [...EPW, "pusan-highlight"], view: PUSAN_VIEW },
  5: { layers: EPW, overlay: "map-overlay-image" },
  6: { layers: [...EPW, "epw-populations"], view: DEFAULT_VIEW },
  7: {
    layers: [...EPW, "kojedo-detail", "kojedo-label"],
    view: KOJEDO_VIEW,
    filters: KOJEDO_FILTERS,
  },
  8: { layers: EPW, overlay: "map-overlay-image-2" },
};

const TOGGLABLE_LAYERS = [
  ...new Set(Object.values(STEPS).flatMap((s) => s.layers || [])),
];
const OVERLAY_IDS = ["map-overlay-image", "map-overlay-image-2"];
const FILTERED_LAYERS = Object.keys(KOJEDO_FILTERS);

function setOverlay(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.opacity = visible ? "1" : "0";
  el.style.pointerEvents = visible ? "auto" : "none";
}

let currentStep = null;

function applyStep(stepIndex) {
  if (stepIndex === currentStep) return;
  currentStep = stepIndex;

  const step = STEPS[stepIndex] || {};
  const visible = step.layers || [];

  closePopup();
  locationPopupsEnabled = Boolean(step.locationPopups);

  TOGGLABLE_LAYERS.forEach((id) =>
    map.setLayoutProperty(id, "visibility", visible.includes(id) ? "visible" : "none"),
  );

  FILTERED_LAYERS.forEach((id) =>
    map.setFilter(id, step.filters?.[id] ?? null),
  );

  OVERLAY_IDS.forEach((id) => setOverlay(id, step.overlay === id));

  map.setPaintProperty("northern-korea", "fill-color", step.northFill || "#cccccc");

  document.querySelectorAll(".progress-dot").forEach((dot) => {
    dot.classList.toggle("active", Number(dot.dataset.step) === stepIndex);
  });

  if (step.view) map.flyTo(step.view);
}

// ── Progress dots (don't depend on the map) ───────────────────
document.querySelectorAll(".progress-dot").forEach((dot) => {
  dot.addEventListener("click", () => {
    const target = dot.dataset.target
      ? document.getElementById(dot.dataset.target)
      : document.querySelector(`.step[data-step="${dot.dataset.step}"]`);
    target?.scrollIntoView({ behavior: "smooth" });
  });
});

// ── Layer helpers ─────────────────────────────────────────────
function points(list) {
  return {
    type: "FeatureCollection",
    features: list.map(([name, coordinates]) => ({
      type: "Feature",
      properties: { name },
      geometry: { type: "Point", coordinates },
    })),
  };
}

function addGeoJsonLayer(id, data, layer) {
  map.addSource(id, { type: "geojson", data });
  map.addLayer({ id, source: id, ...layer });
}

const iconLayout = (image, size = 0.65) => ({
  "icon-image": image,
  "icon-size": size,
  "icon-allow-overlap": true,
  visibility: "none",
});

const HALO_TEXT = {
  "text-color": "#000000",
  "text-halo-color": "#ffffff",
  "text-halo-width": 1.5,
};

// ── Map load ──────────────────────────────────────────────────
map.on("load", () => {
  map.resize();

  addSymbolImage("sym-cross-yellow", drawCross("#ffd000"));
  addSymbolImage("sym-cross-green", drawCross("#29a429"));
  addSymbolImage("sym-square-epw", drawSquareEpw);
  addSymbolImage("sym-triangle-epw", drawTriangleEpw);
  addSymbolImage("sym-pusan-highlight", drawPusanHighlight);

  // Base geography
  addGeoJsonLayer("drop-shadow", "data/drop-shadow.geojson", {
    type: "fill",
    paint: { "fill-color": "#000000", "fill-opacity": 1 },
  });

  addGeoJsonLayer(
    "place-labels",
    points([
      ["YELLOW SEA", [125, 36.0]],
      ["SEA OF JAPAN", [130.3, 39.5]],
      ["CHEJU STRAIT", [127.0, 33.8]],
    ]),
    {
      type: "symbol",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["STIX Two Text Italic"],
        "text-size": 12,
        "text-letter-spacing": 0.2,
      },
      paint: HALO_TEXT,
    },
  );

  addGeoJsonLayer("base", "data/base.geojson", {
    type: "fill",
    paint: { "fill-color": "#ffffff", "fill-outline-color": "#000000" },
  });

  addGeoJsonLayer("northern-korea", "data/northern-korea.geojson", {
    type: "fill",
    paint: { "fill-color": "#cccccc", "fill-outline-color": "rgba(0,0,0,0)" },
  });

  addGeoJsonLayer("northern-islands", "data/northern-islands.geojson", {
    type: "fill",
    paint: { "fill-color": "#cccccc", "fill-outline-color": "#000000" },
  });

  addGeoJsonLayer("regional-states", "data/regional-states.geojson", {
    type: "fill",
    paint: {
      "fill-color": "#000000",
      "fill-opacity": 0.9,
      "fill-outline-color": "#ffffff",
    },
  });

  addGeoJsonLayer(
    "region-labels",
    points([
      ["C H I N A", [125.2, 42]],
      ["J A P A N", [135.7, 35]],
    ]),
    {
      type: "symbol",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Georgia Regular"],
        "text-size": 14,
        "text-letter-spacing": 0.15,
        "text-max-width": 100,
      },
      paint: { "text-color": "#d0d0d0" },
    },
  );

  addGeoJsonLayer("parallel-38", "data/parallel-38.geojson", {
    type: "line",
    paint: {
      "line-color": "#000000",
      "line-width": 1.5,
      "line-dasharray": [6, 4],
    },
  });

  addGeoJsonLayer(
    "parallel-38-label",
    points([["38TH PARALLEL NORTH", [130.2, 38.01]]]),
    {
      type: "symbol",
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["STIX Two Text Italic"],
        "text-size": 10,
        "text-letter-spacing": 0.1,
        "text-offset": [0, -0.8],
        "text-max-width": 100,
      },
      paint: HALO_TEXT,
    },
  );

  addGeoJsonLayer("border", "data/border.geojson", {
    type: "line",
    paint: { "line-color": "#000000", "line-width": 1.25 },
  });

  // Prisons
  addGeoJsonLayer("japanese-colonial-prisons", "data/japanese-colonial-prisons.geojson", {
    type: "symbol",
    layout: iconLayout("sym-cross-yellow"),
  });
  attachPopup("japanese-colonial-prisons");

  addGeoJsonLayer("national-prisons-1946", "data/national-prisons-1946.geojson", {
    type: "symbol",
    layout: iconLayout("sym-cross-green"),
  });
  attachPopup("national-prisons-1946", { enabled: () => locationPopupsEnabled });

  addGeoJsonLayer(
    "national-prison-populations-1946",
    "data/national-prison-populations-1946.geojson",
    {
      type: "circle",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["to-number", ["get", "Population"]],
          0, 4,
          3200, 32,
        ],
        "circle-color": "rgba(23, 153, 44, 0.4)",
      },
    },
  );
  attachPopup("national-prison-populations-1946");

  // EPW camps
  addGeoJsonLayer("epw-facilities", "data/epw-facilities.geojson", {
    type: "symbol",
    layout: iconLayout("sym-square-epw"),
  });
  attachPopup("epw-facilities");

  addGeoJsonLayer("pusan-highlight", points([["Pusan", [129.075, 35.179]]]), {
    type: "symbol",
    layout: iconLayout("sym-pusan-highlight", 1.65),
  });

  addGeoJsonLayer("epw-branch-camps", "data/epw-branch-camps.geojson", {
    type: "symbol",
    layout: iconLayout("sym-triangle-epw"),
  });
  attachPopup("epw-branch-camps");

  addGeoJsonLayer("epw-populations", "data/epw-populations.geojson", {
    type: "circle",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["to-number", ["get", "Population"]],
        300, 18,
        10000, 24,
        50000, 48,
      ],
      "circle-color": "rgba(254, 43, 1, 0.3)",
    },
  });
  attachPopup("epw-populations");

  // Koje-do
  addGeoJsonLayer("kojedo-detail", "data/koje-do.geojson", {
    type: "fill",
    layout: { visibility: "none" },
    paint: {
      "fill-color": "#ff6600",
      "fill-opacity": 0.8,
      "fill-outline-color": "#ff6600",
    },
  });

  addGeoJsonLayer("kojedo-label", points([["Koje-do", [128.76, 34.78]]]), {
    type: "symbol",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["STIX Two Text Italic"],
      "text-size": 13,
      "text-letter-spacing": 0.15,
      "text-max-width": 100,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
      "text-offset": [0, -1.5],
      visibility: "none",
    },
    paint: HALO_TEXT,
  });

  // Cities (period McCune–Reischauer spellings)
  map.addSource("priority-cities", {
    type: "geojson",
    data: points([
      ["Seoul", [126.978, 37.566]],
      ["Pusan", [129.075, 35.179]],
      ["Pyongyang", [125.738, 39.019]],
      ["Taegu", [128.601, 35.871]],
      ["Inchon", [126.705, 37.456]],
      ["Kwangju", [126.852, 35.16]],
      ["Taejon", [127.385, 36.35]],
      ["Wonsan", [127.443, 39.152]],
    ]),
  });
  map.addLayer({
    id: "priority-cities-dots",
    type: "circle",
    source: "priority-cities",
    paint: { "circle-radius": 4, "circle-color": "#000000" },
  });
  map.addLayer({
    id: "priority-cities-labels",
    type: "symbol",
    source: "priority-cities",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Avenir Next Regular"],
      "text-size": 13,
      "text-anchor": "left",
      "text-offset": [0.6, 0],
      "text-max-width": 10,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: { ...HALO_TEXT, "text-halo-width": 1.25 },
  });

  applyStep(0);

  // ── Main scroller ─────────────────────────────────────────
  const scroller = scrollama();
  scroller
    .setup({ step: ".step", offset: 0.5 })
    .onStepEnter(({ element }) => {
      applyStep(parseInt(element.dataset.step, 10));
    })
    .onStepExit(({ direction, index }) => {
      // Covers gaps between steps when scrolling up; applyStep ignores repeats.
      if (direction === "up" && index > 0) {
        const steps = document.querySelectorAll(".step");
        applyStep(parseInt(steps[index - 1].dataset.step, 10));
      }
    });

  window.addEventListener("resize", scroller.resize);
});
