import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const METERS_TO_UNLOCK = 500;
const IMAGES = [
  { id: "01", src: "/img/imatge01.jpg" },
  { id: "02", src: "/img/imatge02.jpg" },
  { id: "03", src: "/img/imatge03.jpg" },
  { id: "04", src: "/img/imatge04.jpg" },
  { id: "05", src: "/img/imatge05.jpg" },
];

const LS_SETTINGS = "walkunlock_settings_v1";
const LS_PROGRESS = "walkunlock_progress_v1";
const LS_ACTIVE = "walkunlock_active_v1";

const el = {
  canvas: document.getElementById("canvas"),
  txtActiveImage: document.getElementById("txtActiveImage"),
  txtMeters: document.getElementById("txtMeters"),
  txtPercent: document.getElementById("txtPercent"),
  badgeStatus: document.getElementById("badgeStatus"),

  btnStartStop: document.getElementById("btnStartStop"),
  btnReset: document.getElementById("btnReset"),
  btnNext: document.getElementById("btnNext"),

  btnSettings: document.getElementById("btnSettings"),
  settingsPanel: document.getElementById("settingsPanel"),
  btnCloseSettings: document.getElementById("btnCloseSettings"),

  togDarkMode: document.getElementById("togDarkMode"),
  togHaptics: document.getElementById("togHaptics"),
  togDemoMode: document.getElementById("togDemoMode"),
  selTileSize: document.getElementById("selTileSize"),

  demoControls: document.getElementById("demoControls"),
  btnAdd50: document.getElementById("btnAdd50"),
  btnAdd200: document.getElementById("btnAdd200"),

  btnGallery: document.getElementById("btnGallery"),
  galleryModal: document.getElementById("galleryModal"),
  btnCloseGallery: document.getElementById("btnCloseGallery"),
  galleryGrid: document.getElementById("galleryGrid"),
  progressFill: document.getElementById("progressFill"),

  viewerModal: document.getElementById("viewerModal"),
  btnCloseViewer: document.getElementById("btnCloseViewer"),
  viewerImg: document.getElementById("viewerImg"),
  viewerTitle: document.getElementById("viewerTitle"),
  btnZoomIn: document.getElementById("btnZoomIn"),
  btnZoomOut: document.getElementById("btnZoomOut"),
  btnZoomReset: document.getElementById("btnZoomReset"),
  viewerZoomLabel: document.getElementById("viewerZoomLabel"),
};

const ctx = el.canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const state = {
  settings: {
    darkMode: false,
    tileSize: 24,
    haptics: true,
    demoMode: false,
  },
  progressByImage: { "01": 0, "02": 0, "03": 0, "04": 0, "05": 0 },
  activeId: "01",
  // session
  isWalking: false,
  distanceMeters: 0,
  lastLatLng: null,
  watchTimer: null,

  // rendering
  image: null,
  unlockAnimating: false,
  tileOrder: [],
};


let viewerScale = 1;

function openViewer(imgObj) {
  viewerScale = 1;
  el.viewerImg.style.transform = `scale(${viewerScale})`;
  el.viewerZoomLabel.textContent = "100%";
  el.viewerImg.src = imgObj.src;
  el.viewerTitle.textContent = `imatge${imgObj.id}`;
  setHidden(el.viewerModal, false);
}

function setViewerScale(newScale) {
  viewerScale = clamp(newScale, 1, 4);
  el.viewerImg.style.transform = `scale(${viewerScale})`;
  el.viewerZoomLabel.textContent = `${Math.round(viewerScale * 100)}%`;
}

init();

async function init() {
  loadFromStorage();
  applySettingsToUI();

  // DEMO: start at imatge01
  state.activeId = IMAGES[0].id;
  saveActiveId();

  wireUI();
  await loadActiveImage();
  updateUI();
  render();
  buildGallery();
}

function wireUI() {
  el.btnStartStop.addEventListener("click", async () => {
    if (state.isWalking) stopWalking();
    else await startWalking();
  });

  el.btnReset.addEventListener("click", async () => {
    // Reset the whole game (all images) – useful for testing/demo
    const ok = confirm("Vols reiniciar TOT el progrés? (totes les imatges tornaran a 0%)");
    if (!ok) return;

    stopWalking();
    state.distanceMeters = 0;
    state.lastLatLng = null;

    // Reset progress for all images
    for (const img of IMAGES) state.progressByImage[img.id] = 0;
    saveProgress();

    // Go back to first image
    state.activeId = IMAGES[0].id;
    saveActiveId();

    await loadActiveImage();
    updateUI();
    render();
    buildGallery();
  });
el.btnNext.addEventListener("click", async () => {
    // allow moving around manually; doesn't change unlock state
    state.activeId = nextId(state.activeId);
    saveActiveId();
    await loadActiveImage();
    updateUI();
    render();
    buildGallery();
  });

  // Settings panel
  el.btnSettings.addEventListener("click", () => setHidden(el.settingsPanel, false));
  el.btnCloseSettings.addEventListener("click", () => setHidden(el.settingsPanel, true));

  el.togDarkMode.addEventListener("change", () => {
    state.settings.darkMode = el.togDarkMode.checked;
    applyTheme();
    saveSettings();
  });

  el.togHaptics.addEventListener("change", () => {
    state.settings.haptics = el.togHaptics.checked;
    saveSettings();
  });

  el.togDemoMode.addEventListener("change", () => {
    state.settings.demoMode = el.togDemoMode.checked;
    el.demoControls.hidden = !state.settings.demoMode;
    saveSettings();
  });

  el.selTileSize.addEventListener("change", async () => {
    state.settings.tileSize = Number(el.selTileSize.value);
    saveSettings();
    computeTileOrder(); // depends on tile size
    render();
  });

  // Demo controls
  el.btnAdd50.addEventListener("click", () => addMeters(50));
  el.btnAdd200.addEventListener("click", () => addMeters(200));

  // Gallery
  el.btnGallery.addEventListener("click", () => setHidden(el.galleryModal, false));
  el.btnCloseGallery.addEventListener("click", () => setHidden(el.galleryModal, true));
  el.galleryModal.addEventListener("click", (ev) => {
    if (ev.target === el.galleryModal) setHidden(el.galleryModal, true);
  });


  // Viewer (zoom modal)
  el.btnCloseViewer.addEventListener("click", () => setHidden(el.viewerModal, true));
  el.viewerModal.addEventListener("click", (ev) => {
    if (ev.target === el.viewerModal) setHidden(el.viewerModal, true);
  });
  el.btnZoomIn.addEventListener("click", () => setViewerScale(viewerScale + 0.25));
  el.btnZoomOut.addEventListener("click", () => setViewerScale(viewerScale - 0.25));
  el.btnZoomReset.addEventListener("click", () => setViewerScale(1));

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      setHidden(el.galleryModal, true);
      setHidden(el.settingsPanel, true);
      setHidden(el.viewerModal, true);
    }
  });

  // Resize render
  window.addEventListener("resize", () => render());
}

function setHidden(node, hidden) {
  node.hidden = hidden;
}

function loadFromStorage() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SETTINGS) || "null");
    if (s && typeof s === "object") state.settings = { ...state.settings, ...s };
  } catch {}

  try {
    const p = JSON.parse(localStorage.getItem(LS_PROGRESS) || "null");
    if (p && typeof p === "object") state.progressByImage = { ...state.progressByImage, ...p };
  } catch {}

  const a = localStorage.getItem(LS_ACTIVE);
  if (a && IMAGES.some(x => x.id === a)) state.activeId = a;

  applyTheme();
}

function saveSettings() {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(state.settings));
}

function saveProgress() {
  localStorage.setItem(LS_PROGRESS, JSON.stringify(state.progressByImage));
}

function saveActiveId() {
  localStorage.setItem(LS_ACTIVE, state.activeId);
}

function applySettingsToUI() {
  el.togDarkMode.checked = !!state.settings.darkMode;
  el.togHaptics.checked = !!state.settings.haptics;
  el.togDemoMode.checked = !!state.settings.demoMode;
  el.selTileSize.value = String(state.settings.tileSize);
  el.demoControls.hidden = !state.settings.demoMode;
}

function applyTheme() {
  document.body.classList.toggle("light", !!state.settings.darkMode);
}

function pickFirstIncomplete(fallbackId) {
  const first = IMAGES.find(img => (state.progressByImage[img.id] ?? 0) < 1);
  return first ? first.id : fallbackId;
}

async function loadActiveImage() {
  const img = IMAGES.find(x => x.id === state.activeId) || IMAGES[0];
  state.activeId = img.id;
  saveActiveId();

  state.image = await loadImage(img.src);
  computeTileOrder();
}

function computeTileOrder() {
  const tileSize = state.settings.tileSize;
  const cols = Math.floor(el.canvas.width / tileSize);
  const rows = Math.floor(el.canvas.height / tileSize);
  const total = cols * rows;

  // Seeded shuffle so the same image always reveals the same tiles
  const seed = hashString(`imatge${state.activeId}-${tileSize}`);
  const rng = mulberry32(seed);

  const arr = Array.from({ length: total }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  state.tileOrder = arr;
}

function updateUI() {
  el.txtActiveImage.textContent = state.activeId;
  el.txtMeters.textContent = Math.round(state.distanceMeters).toString();

  const p = getProgressForActive();
  const pct = Math.round(p * 100);
  el.txtPercent.textContent = pct.toString();
  if (el.progressFill) el.progressFill.style.width = `${pct}%`;

  el.btnStartStop.textContent = state.isWalking ? "Stop" : "Start";

  // The unlock badge is only shown during the unlock animation
  if (!state.unlockAnimating) {
    el.badgeStatus.hidden = true;
    el.badgeStatus.classList.remove("animate");
  }
}

function getProgressForActive() {
  return clamp(state.progressByImage[state.activeId] ?? 0, 0, 1);
}

function setProgressForActive(val) {
  state.progressByImage[state.activeId] = clamp(val, 0, 1);
}

function addMeters(m) {
  state.distanceMeters = clamp(state.distanceMeters + m, 0, METERS_TO_UNLOCK);
  const p = clamp(state.distanceMeters / METERS_TO_UNLOCK, 0, 1);
  setProgressForActive(p);
  updateUI();
  render();
  saveProgress();

  if (p >= 1) onUnlocked();
}

async function startWalking() {
  state.isWalking = true;
  updateUI();

  // Request permissions (on device/emulator)
  try {
    await Geolocation.requestPermissions();
  } catch (err) {
    console.warn("Geolocation permissions request failed:", err);
  }

  // Poll every ~2.5s to keep it simple
  state.watchTimer = window.setInterval(async () => {
    if (!state.isWalking) return;

    try {
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 5000,
      });

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const now = { lat, lng };

      if (state.lastLatLng) {
        const d = haversineMeters(state.lastLatLng, now);
        // Ignore weird jumps (GPS spikes)
        if (d > 0.5 && d < 50) {
          state.distanceMeters = clamp(state.distanceMeters + d, 0, METERS_TO_UNLOCK);
          const p = clamp(state.distanceMeters / METERS_TO_UNLOCK, 0, 1);
          setProgressForActive(p);
          saveProgress();
        }
      }
      state.lastLatLng = now;

      updateUI();
      render();

      if (getProgressForActive() >= 1) onUnlocked();

    } catch (err) {
      // In emulator, location might not be set yet; keep quiet
      console.warn("Geolocation getCurrentPosition error:", err);
    }
  }, 2500);
}

function stopWalking() {
  state.isWalking = false;
  if (state.watchTimer) {
    clearInterval(state.watchTimer);
    state.watchTimer = null;
  }
  updateUI();
}

async function onUnlocked() {
  // Prevent re-trigger
  if (state._unlocking) return;
  state._unlocking = true;

  stopWalking();
  setProgressForActive(1);
  state.distanceMeters = METERS_TO_UNLOCK;
  saveProgress();
  updateUI();
  render();
  buildGallery();

  // Show centered animated message (1s)
  state.unlockAnimating = true;
  el.badgeStatus.hidden = false;
  el.badgeStatus.classList.add("animate");
  // Vibrate during the animation
  await vibrateFor(1000);
  // Hide message after animation
  el.badgeStatus.hidden = true;
  el.badgeStatus.classList.remove("animate");
  state.unlockAnimating = false;


  // Auto-pass to next incomplete
  const nextIncomplete = IMAGES.find(img => (state.progressByImage[img.id] ?? 0) < 1);
  if (!nextIncomplete) {
    // All complete
    setTimeout(async () => {
      await doHaptic(ImpactStyle.Heavy);
      alert("Has desbloquejat totes les imatges d'aquesta DEMO! Enhorabona!");
      state._unlocking = false;
    }, 200);
    return;
  }

  // Small delay so user sees "Unlocked!"
  setTimeout(async () => {
    state.activeId = nextIncomplete.id;
    saveActiveId();
    state.distanceMeters = 0;
    state.lastLatLng = null;

    await loadActiveImage();
    updateUI();
    render();
    buildGallery();

    await doHaptic(ImpactStyle.Light);

    state._unlocking = false;
  }, 400);
}


async function vibrateFor(ms) {
  if (!state.settings.haptics) return;
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = async () => {
      const elapsed = Date.now() - start;
      if (elapsed >= ms) {
        clearInterval(timer);
        resolve();
        return;
      }
      try {
        if (Haptics.vibrate) await Haptics.vibrate({ duration: 150 });
        else await Haptics.impact({ style: ImpactStyle.Light });
      } catch {}
    };
    const timer = setInterval(() => { tick(); }, 180);
    tick();
  });
}

async function doHaptic(style) {
  if (!state.settings.haptics) return;
  try {
    await Haptics.impact({ style });
  } catch (err) {
    // If running purely in browser, haptics might not exist; ignore.
    // (Capacitor still lets you develop in web)
  }
}

function render() {
  if (!state.image) return;

  const w = el.canvas.width;
  const h = el.canvas.height;

  // 1) Draw pixelated placeholder
  drawPixelatedImage(state.image);

  // 2) Reveal tiles
  const tileSize = state.settings.tileSize;
  const cols = Math.floor(w / tileSize);
  const rows = Math.floor(h / tileSize);
  const totalTiles = cols * rows;

  const progress = getProgressForActive();
  const tilesToShow = Math.floor(progress * totalTiles);

  for (let k = 0; k < tilesToShow; k++) {
    const idx = state.tileOrder[k];
    const cx = idx % cols;
    const cy = Math.floor(idx / cols);

    const sx = cx * tileSize;
    const sy = cy * tileSize;

    ctx.drawImage(state.image, sx, sy, tileSize, tileSize, sx, sy, tileSize, tileSize);
  }
}

function drawPixelatedImage(img) {
  const w = el.canvas.width;
  const h = el.canvas.height;
  const scale = 0.05; // smaller -> chunkier pixels

  const sw = Math.max(1, Math.floor(w * scale));
  const sh = Math.max(1, Math.floor(h * scale));

  // Draw downscaled into an offscreen canvas (fast + clean)
  const off = getOffscreen(sw, sh);
  const octx = off.getContext("2d");
  octx.imageSmoothingEnabled = true;
  octx.clearRect(0, 0, sw, sh);
  octx.drawImage(img, 0, 0, sw, sh);

  // Scale back up without smoothing for pixel effect
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(off, 0, 0, sw, sh, 0, 0, w, h);
  ctx.restore();
}

let _offscreen = null;
function getOffscreen(w, h) {
  if (!_offscreen || _offscreen.width !== w || _offscreen.height !== h) {
    _offscreen = document.createElement("canvas");
    _offscreen.width = w;
    _offscreen.height = h;
  }
  return _offscreen;
}


function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

function buildGallery() {
  el.galleryGrid.innerHTML = "";
  for (const img of IMAGES) {
    const p = clamp(state.progressByImage[img.id] ?? 0, 0, 1);
    const unlocked = p >= 1;

    const card = document.createElement("div");
    card.className = "thumb";
    card.title = unlocked ? "Desbloquejada" : `Bloquejada (${Math.round(p*100)}%)`;

    const im = document.createElement("img");
    im.src = img.src;
    im.alt = `imatge${img.id}`;

    card.appendChild(im);

    if (!unlocked) {
      const overlay = document.createElement("div");
      overlay.className = "overlay";
      overlay.textContent = "🔒";
      card.appendChild(overlay);
    }

    const pct = document.createElement("div");
    pct.className = "pct";
    pct.textContent = `${Math.round(p * 100)}%`;
    card.appendChild(pct);

    card.addEventListener("click", async () => {
      const unlockedNow = (clamp(state.progressByImage[img.id] ?? 0, 0, 1)) >= 1;

      if (unlockedNow) {
        // View unlocked image cleanly (no badge), with zoom controls
        setHidden(el.galleryModal, true);
        openViewer(img);
        return;
      }

      // Locked: activate to start unlocking it
      stopWalking();
      state.unlockAnimating = false;
      el.badgeStatus.hidden = true;
      el.badgeStatus.classList.remove("animate");
      state.activeId = img.id;
      saveActiveId();
      state.distanceMeters = Math.round((state.progressByImage[img.id] ?? 0) * METERS_TO_UNLOCK);
      state.lastLatLng = null;
      await loadActiveImage();
      updateUI();
      render();
      setHidden(el.galleryModal, true);
    });

    el.galleryGrid.appendChild(card);
  }
}

function nextId(currentId) {
  const idx = IMAGES.findIndex(x => x.id === currentId);
  if (idx === -1) return IMAGES[0].id;
  return IMAGES[(idx + 1) % IMAGES.length].id;
}

// --- Utils ---
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function haversineMeters(a, b) {
  const R = 6371000; // Earth radius in meters
  const toRad = (x) => (x * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLon / 2);

  const h = sin1 * sin1 + Math.cos(lat1) * Math.cos(lat2) * sin2 * sin2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

// Hash a string into uint32
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

// Deterministic PRNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
