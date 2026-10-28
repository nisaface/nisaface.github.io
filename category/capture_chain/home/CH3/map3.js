const isMobile = window.innerWidth < 768;
const isMobileLandscape =
  window.innerWidth < 900 && window.innerHeight < window.innerWidth;

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
  center: isMobileLandscape
    ? [137.5, 36.5]
    : isMobile
      ? [127.5, 35.5]
      : [130.5, 37.68],
  zoom: isMobile ? 4.5 : 5.5,
  minZoom: isMobile ? 4 : 5.5,
  maxZoom: 7,
  renderWorldCopies: false,
  maxBounds: [
    [119.0, 32.0],
    [142.0, 44.0],
  ],
  interactive: true,
});

map.addControl(new maplibregl.NavigationControl(), "top-left");
map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");

// ── Popup helper ────────────────────────────────
function facilityPopup(props) {
  const fields = [
    { key: "Type", label: "" },
    { key: "Name_1", label: "Compound:" },
    { key: "Capacity", label: "Capacity:" },
    { key: "Population", label: "Population:" },
  ];
  const rows = fields
    .filter(
      (f) =>
        props[f.key] !== undefined &&
        props[f.key] !== null &&
        props[f.key] !== "",
    )
    .map((f) => {
      const val = props[f.key];
      // Turn population red if it exceeds capacity
      const isOverCapacity =
        f.key === "Population" &&
        props["Capacity"] &&
        parseInt(val) > parseInt(props["Capacity"]);

      const valueStyle = isOverCapacity
        ? "padding:2px 0;color:#cc0000;font-weight:700;"
        : "padding:2px 0";

      return f.label === ""
        ? `<tr><td colspan="2" style="${valueStyle}">${val}</td></tr>`
        : `<tr><td style="color:#666;padding:2px 8px 2px 0;white-space:nowrap">${f.label}</td><td style="${valueStyle}">${val}</td></tr>`;
    })
    .join("");
  return `
  <div style="font-weight:700;margin-bottom:8px;">${props["Name"] || ""}</div>
  <table style="font-size:12px;border-collapse:collapse">${rows}</table>
`;
}

let activePopup = null;

// Flag to control whether national prison location popups are enabled
let locationPopupsEnabled = true;

function attachPopup(layerId, popupFn = facilityPopup) {
  map.on("mouseenter", layerId, (e) => {
    // Disable location popups at step 2 (population step)
    if (layerId === "national-prisons-1946" && !locationPopupsEnabled) return;

    if (!e.features.length) return;
    map.getCanvas().style.cursor = "pointer";

    const coords =
      e.features[0].geometry.type === "Point"
        ? e.features[0].geometry.coordinates.slice()
        : e.lngLat;

    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }

    activePopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 10,
    })
      .setLngLat(coords)
      .setHTML(popupFn(e.features[0].properties))
      .addTo(map);
  });

  map.on("mouseleave", layerId, () => {
    map.getCanvas().style.cursor = "";
    if (activePopup) {
      activePopup.remove();
      activePopup = null;
    }
  });
}

// Symbol image helper
function addSymbolImage(map, name, drawFn, size = 24) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  drawFn(ctx, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  map.addImage(name, { width: size, height: size, data: imageData.data });
}

// Scrollly layer visibility ───────

const stepLayers = {
  0: ["japanese-colonial-prisons"],
  1: ["national-prisons-1946"],
  2: ["national-prisons-1946", "national-prison-populations-1946"],
  3: ["epw-facilities", "epw-branch-camps"],
  4: ["epw-facilities", "epw-branch-camps"], // flyTo Busan,
  5: ["epw-facilities", "epw-branch-camps"], // Busan image appears
  6: ["epw-facilities", "epw-branch-camps", "epw-populations"], // was 5
  7: ["epw-facilities", "epw-branch-camps"], // Koje-do zoom
  8: ["epw-facilities", "epw-branch-camps"], // Koje-do image
};

// All togglable layers. base layers are always on and so not listed here---this is only usefule if i want to toggle on and off layers.
const allTogglableLayers = [
  "japanese-colonial-prisons",
  "national-prisons-1946",
  "national-prison-populations-1946",
  "epw-facilities",
  "epw-branch-camps",
  "epw-populations",
];

const BUSAN = { center: [129.25, 35.1], zoom: 10 };
const KOJEDO = { center: [129, 34.87], zoom: 11 };
const DEFAULT = {
  center: isMobile ? [127.5, 35.5] : [130.5, 37.68],
  zoom: isMobile ? 4.5 : 5.5,
};

function showImageOverlay() {
  const el = document.getElementById("map-overlay-image");
  el.style.opacity = "1";
  el.style.pointerEvents = "auto";
}

function hideImageOverlay() {
  const el = document.getElementById("map-overlay-image");
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
}

function showImageOverlay2() {
  const el = document.getElementById("map-overlay-image-2");
  el.style.opacity = "1";
  el.style.pointerEvents = "auto";
}

function hideImageOverlay2() {
  const el = document.getElementById("map-overlay-image-2");
  el.style.opacity = "0";
  el.style.pointerEvents = "none";
}

function applyStep(stepIndex) {
  // Close any open popup on step change
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }

  // Location popups only enabled at step 1, disabled at step 2+
  locationPopupsEnabled = stepIndex === 1;

  const visible = stepLayers[stepIndex] || [];
  allTogglableLayers.forEach((layerId) => {
    const visibility = visible.includes(layerId) ? "visible" : "none";
    map.setLayoutProperty(layerId, "visibility", visibility);
  });

  document.querySelectorAll(".progress-dot").forEach((dot) => {
    dot.classList.toggle("active", parseInt(dot.dataset.step) === stepIndex);
  });

  // North Korea fill color changes by step--goal is to have it appear first as a unified peninsula and then change to reflect the partition

  if (stepIndex === 0) {
    map.setPaintProperty("northern-korea", "fill-color", "#ffffff");
  } else {
    map.setPaintProperty("northern-korea", "fill-color", "#cccccc");
  }

  if (stepIndex === 3) {
    map.flyTo({
      center: DEFAULT.center,
      zoom: DEFAULT.zoom,
      pitch: 0,
      bearing: 0,
      duration: 1200,
    });
  }

  // Busan flyTo step — no image just yet
  if (stepIndex === 4) {
    map.flyTo({
      center: BUSAN.center,
      zoom: BUSAN.zoom,
      duration: 1500,
      pitch: 60,
    });
    hideImageOverlay();
    map.setLayoutProperty("pusan-highlight", "visibility", "visible");
  } else {
    map.setLayoutProperty("pusan-highlight", "visibility", "none");
  }

  // Busan image step / image added here
  if (stepIndex === 5) {
    showImageOverlay();
  } else {
    hideImageOverlay();
  }

  // Zoom back to default and shft the pitch back to 0
  if (stepIndex === 6) {
    map.flyTo({
      center: DEFAULT.center,
      zoom: DEFAULT.zoom,
      pitch: 0,
      duration: 1200,
    });
  }

  // Koje-do zoom step
  if (stepIndex === 7) {
    map.flyTo({
      center: KOJEDO.center,
      zoom: KOJEDO.zoom,
      duration: 1500,
      pitch: 60,
    });
    hideImageOverlay2();
    map.setLayoutProperty("kojedo-detail", "visibility", "visible");

    // Show Koje-do label
    map.setLayoutProperty("kojedo-label", "visibility", "visible");

    // Hide only Koje-do facilities so the polygon can be introed
    map.setFilter("epw-facilities", [
      "!",
      ["in", ["get", "Name"], ["literal", ["Koje-do"]]],
    ]);
    map.setFilter("epw-branch-camps", [
      "!",
      [
        "in",
        ["get", "Name"],
        ["literal", ["Chogu-ri", "Yoncho-do", "Pongam-do"]],
      ],
    ]);
  } else {
    map.setLayoutProperty("kojedo-detail", "visibility", "none");

    // Remove filters to restore all features--not sure if i need
    map.setFilter("epw-facilities", null);
    map.setFilter("epw-branch-camps", null);
    map.setLayoutProperty("kojedo-label", "visibility", "none");
  }

  // Koje-do image step
  if (stepIndex === 8) {
    showImageOverlay2();
  } else {
    hideImageOverlay2();
  }
}

// Map stuff

map.on("load", () => {
  map.resize(); // ensure canvas fills container

  // Symbols
  addSymbolImage(map, "sym-cross-yellow", (ctx, s) => {
    const t = s * 0.13;
    ctx.fillStyle = "#000000";
    ctx.fillRect(s / 2 - t / 2 - 1, 0, t + 2, s);
    ctx.fillRect(0, s / 2 - t / 2 - 1, s, t + 2);
    ctx.fillStyle = "#ffd000";
    ctx.fillRect(s / 2 - t / 2, 1, t, s - 2);
    ctx.fillRect(1, s / 2 - t / 2, s - 2, t);
  });

  addSymbolImage(map, "sym-cross-green", (ctx, s) => {
    const t = s * 0.13;
    ctx.fillStyle = "#000000";
    ctx.fillRect(s / 2 - t / 2 - 1, 0, t + 2, s);
    ctx.fillRect(0, s / 2 - t / 2 - 1, s, t + 2);
    ctx.fillStyle = "#29a429";
    ctx.fillRect(s / 2 - t / 2, 1, t, s - 2);
    ctx.fillRect(1, s / 2 - t / 2, s - 2, t);
  });

  addSymbolImage(map, "sym-square-epw", (ctx, s) => {
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(2, 2, s - 4, s - 4);
    ctx.fillStyle = "#000000";
    ctx.fillRect(3, 3, s - 6, s - 6);
  });

  addSymbolImage(map, "sym-triangle-epw", (ctx, s) => {
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
  });

  // highlighted camp--was square but i made it a circle

  addSymbolImage(map, "sym-square-epw-highlight", (ctx, s) => {
    const cx = s / 2;
    const cy = s / 2;
    const outerR = s / 2 - 1;
    const orangeR = s / 2 - 1.25;
    const innerR = 1.6;

    // white border
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // orange ring
    ctx.beginPath();
    ctx.arc(cx, cy, orangeR, 0, Math.PI * 2);
    ctx.fillStyle = "#ff6600";
    ctx.fill();

    // black center dot
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();
  });

  // Base map layers

  map.addSource("drop-shadow", {
    type: "geojson",
    data: "data/drop-shadow.geojson",
  });
  map.addLayer({
    id: "drop-shadow",
    type: "fill",
    source: "drop-shadow",
    paint: { "fill-color": "#000000", "fill-opacity": 1 },
  });

  map.addSource("place-labels", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "YELLOW SEA" },
          geometry: { type: "Point", coordinates: [125, 36.0] },
        },
        {
          type: "Feature",
          properties: { name: "SEA OF JAPAN" },
          geometry: { type: "Point", coordinates: [130.3, 39.5] },
        },
        {
          type: "Feature",
          properties: { name: "CHEJU STRAIT" },
          geometry: { type: "Point", coordinates: [127.0, 33.8] },
        },
      ],
    },
  });
  map.addLayer({
    id: "place-labels",
    type: "symbol",
    source: "place-labels",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["STIX Two Text Italic"],
      "text-size": 12,
      "text-letter-spacing": 0.2,
    },
    paint: {
      "text-color": "#000000",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  });

  map.addSource("base", { type: "geojson", data: "data/base.geojson" });
  map.addLayer({
    id: "base",
    type: "fill",
    source: "base",
    paint: { "fill-color": "#ffffff", "fill-outline-color": "#000000" },
  });

  map.addSource("northern-korea", {
    type: "geojson",
    data: "data/northern-korea.geojson",
  });
  map.addLayer({
    id: "northern-korea",
    type: "fill",
    source: "northern-korea",
    paint: { "fill-color": "#cccccc", "fill-outline-color": "rgba(0,0,0,0)" },
  });

  map.addSource("northern-islands", {
    type: "geojson",
    data: "data/northern-islands.geojson",
  });
  map.addLayer({
    id: "northern-islands",
    type: "fill",
    source: "northern-islands",
    paint: { "fill-color": "#cccccc", "fill-outline-color": "#000000" },
  });

  map.addSource("regional-states", {
    type: "geojson",
    data: "data/regional-states.geojson",
  });
  map.addLayer({
    id: "regional-states",
    type: "fill",
    source: "regional-states",
    paint: {
      "fill-color": "#000000",
      "fill-opacity": 0.9,
      "fill-outline-color": "#ffffff",
    },
  });

  map.addSource("region-labels", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "C H I N A" },
          geometry: { type: "Point", coordinates: [125.2, 42] },
        },
        {
          type: "Feature",
          properties: { name: "J A P A N" },
          geometry: { type: "Point", coordinates: [135.7, 35] },
        },
      ],
    },
  });
  map.addLayer({
    id: "region-labels",
    type: "symbol",
    source: "region-labels",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Georgia Regular"],
      "text-size": 14,
      "text-letter-spacing": 0.15,
      "text-max-width": 100,
    },
    paint: {
      "text-color": "#d0d0d0",
    },
  });

  map.addSource("parallel-38", {
    type: "geojson",
    data: "data/parallel-38.geojson",
  });
  map.addLayer({
    id: "parallel-38",
    type: "line",
    source: "parallel-38",
    paint: {
      "line-color": "#000000",
      "line-width": 1.5,
      "line-dasharray": [6, 4],
    },
  });

  map.addSource("parallel-38-labels", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "38TH PARALLEL NORTH" },
          geometry: { type: "Point", coordinates: [130.2, 38.01] },
        },
      ],
    },
  });
  map.addLayer({
    id: "parallel-38-label",
    type: "symbol",
    source: "parallel-38-labels",
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["STIX Two Text Italic"],
      "text-size": 10,
      "text-letter-spacing": 0.1,
      "text-offset": [0, -0.8],
      "text-max-width": 100,
    },
    paint: {
      "text-color": "#000000",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  });

  map.addSource("border", { type: "geojson", data: "data/border.geojson" });
  map.addLayer({
    id: "border",
    type: "line",
    source: "border",
    paint: { "line-color": "#000000", "line-width": 1.25 },
  });

  // ── Togglable layers (i moved away from this function but am keeping the code in case i want to do it again with another map)

  map.addSource("japanese-colonial-prisons", {
    type: "geojson",
    data: "data/japanese-colonial-prisons.geojson",
  });
  map.addLayer({
    id: "japanese-colonial-prisons",
    type: "symbol",
    source: "japanese-colonial-prisons",
    layout: {
      "icon-image": "sym-cross-yellow",
      "icon-size": 0.65,
      "icon-allow-overlap": true,
      visibility: "none",
    },
  });
  attachPopup("japanese-colonial-prisons");

  map.addSource("national-prisons-1946", {
    type: "geojson",
    data: "data/national-prisons-1946.geojson",
  });
  map.addLayer({
    id: "national-prisons-1946",
    type: "symbol",
    source: "national-prisons-1946",
    layout: {
      "icon-image": "sym-cross-green",
      "icon-size": 0.65,
      "icon-allow-overlap": true,
      visibility: "none",
    },
  });
  attachPopup("national-prisons-1946");

  map.addSource("national-prison-populations-1946", {
    type: "geojson",
    data: "data/national-prison-populations-1946.geojson",
  });
  map.addLayer({
    id: "national-prison-populations-1946",
    type: "circle",
    source: "national-prison-populations-1946",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["to-number", ["get", "Population"]],
        0,
        4,
        3200,
        32,
      ],

      "circle-color": "rgba(23, 153, 44, 0.4)",
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 0,
    },
  });
  attachPopup("national-prison-populations-1946");

  map.addSource("epw-facilities", {
    type: "geojson",
    data: "data/epw-facilities.geojson",
  });
  map.addLayer({
    id: "epw-facilities",
    type: "symbol",
    source: "epw-facilities",
    layout: {
      "icon-image": "sym-square-epw",
      "icon-size": 0.65,
      "icon-allow-overlap": true,
      visibility: "none",
    },
  });
  attachPopup("epw-facilities");

  map.addSource("pusan-highlight", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { Name: "Pusan" },
          geometry: { type: "Point", coordinates: [129.075, 35.179] },
        },
      ],
    },
  });
  map.addLayer({
    id: "pusan-highlight",
    type: "symbol",
    source: "pusan-highlight",
    layout: {
      "icon-image": "sym-square-epw-highlight",
      "icon-size": 1.65,
      "icon-allow-overlap": true,
      visibility: "none",
    },
  });

  map.addSource("epw-branch-camps", {
    type: "geojson",
    data: "data/epw-branch-camps.geojson",
  });
  map.addLayer({
    id: "epw-branch-camps",
    type: "symbol",
    source: "epw-branch-camps",
    layout: {
      "icon-image": "sym-triangle-epw",
      "icon-size": 0.65,
      "icon-allow-overlap": true,
      visibility: "none",
    },
  });
  attachPopup("epw-branch-camps");

  map.addSource("epw-populations", {
    type: "geojson",
    data: "data/epw-populations.geojson",
  });
  map.addLayer({
    id: "epw-populations",
    type: "circle",
    source: "epw-populations",
    layout: { visibility: "none" },
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["get", "Population"],
        300,
        18,
        10000,
        24,
        50000,
        48,
      ],
      "circle-color": "rgba(254, 43, 1, 0.3)",
      "circle-stroke-color": "#000000",
      "circle-stroke-width": 0,
    },
  });
  attachPopup("epw-populations");

  // adding the Koje-do polygon

  map.addSource("kojedo-detail", {
    type: "geojson",
    data: "data/koje-do.geojson",
  });
  map.addLayer({
    id: "kojedo-detail",
    type: "fill",
    source: "kojedo-detail",
    layout: {
      visibility: "none",
    },
    paint: {
      "fill-color": "#ff6600",
      "fill-opacity": 0.8,
      "fill-outline-color": "#ff6600",
    },
  });

  // ── and the KOje-do label

  map.addSource("kojedo-label", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Koje-do" },
          geometry: { type: "Point", coordinates: [128.76, 34.78] },
        },
      ],
    },
  });
  map.addLayer({
    id: "kojedo-label",
    type: "symbol",
    source: "kojedo-label",
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
    paint: {
      "text-color": "#000000",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.5,
    },
  });

  // city labels ───────────────────
  map.addSource("priority-cities", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { NAME: "Seoul" },
          geometry: { type: "Point", coordinates: [126.978, 37.566] },
        },
        {
          type: "Feature",
          properties: { NAME: "Pusan" },
          geometry: { type: "Point", coordinates: [129.075, 35.179] },
        },
        {
          type: "Feature",
          properties: { NAME: "Pyongyang" },
          geometry: { type: "Point", coordinates: [125.738, 39.019] },
        },
        {
          type: "Feature",
          properties: { NAME: "Daegu" },
          geometry: { type: "Point", coordinates: [128.601, 35.871] },
        },
        {
          type: "Feature",
          properties: { NAME: "Inchon" },
          geometry: { type: "Point", coordinates: [126.705, 37.456] },
        },
        {
          type: "Feature",
          properties: { NAME: "Gwangju" },
          geometry: { type: "Point", coordinates: [126.852, 35.16] },
        },
        {
          type: "Feature",
          properties: { NAME: "Taejon" },
          geometry: { type: "Point", coordinates: [127.385, 36.35] },
        },
        {
          type: "Feature",
          properties: { NAME: "Wonsan" },
          geometry: { type: "Point", coordinates: [127.443, 39.152] },
        },
      ],
    },
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
      "text-field": ["get", "NAME"],
      "text-font": ["Avenir Next Regular"],
      "text-size": 13,
      "text-anchor": "left",
      "text-offset": [0.6, 0],
      "text-max-width": 10,
      "text-allow-overlap": true,
      "text-ignore-placement": true,
    },
    paint: {
      "text-color": "#000000",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.25,
    },
  });

  // Apply initial step
  applyStep(0);

  // ── Scrollama setup ──────────────────────────────
  const scroller = scrollama();

  scroller
    .setup({
      step: ".step",
      offset: 0.5,
      debug: false,
    })
    .onStepEnter((response) => {
      const stepIndex = parseInt(response.element.dataset.step);
      applyStep(stepIndex);
    })
    .onStepExit((response) => {
      if (response.direction === "up" && response.index > 0) {
        const steps = document.querySelectorAll(".step");
        const prevStep = steps[response.index - 1];
        applyStep(parseInt(prevStep.dataset.step));
      }
    });

  // Progress dot clicks jump to step
  document.querySelectorAll(".progress-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      const stepIndex = parseInt(dot.dataset.step);
      const target = document.querySelector(`.step[data-step="${stepIndex}"]`);
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });

  document.querySelectorAll(".progress-dot[data-target]").forEach((dot) => {
    dot.addEventListener("click", () => {
      const target = document.getElementById(dot.dataset.target);
      if (target) target.scrollIntoView({ behavior: "smooth" });
    });
  });

  // Resize handler for Scrollama
  window.addEventListener("resize", scroller.resize);
});
