"use strict";

// Five evenly spaced palette stops, LIGHTEST to DARKEST. Edit palettes here.
const denominations = {
  1: {
    frontBackground: "assets/1-front-background.png",
    backBackground: "assets/1-back-background.png",
    palette: ["#FDFEFA", "#F0F1DB", "#D2D8B6", "#7D9466", "#4E7035"]
  },
  5: {
    frontBackground: "assets/5-front-background.png",
    backBackground: "assets/5-back-background.png",
    palette: ["#FBF7FB", "#EBDFEE", "#B37A2D", "#D7C0DE", "#100006"]
  },
  10: {
    frontBackground: "assets/10-front-background.png",
    backBackground: "assets/10-back-background.png",
    palette: ["#F6FDFF", "#EAFEFF", "#56A4AE", "#F1B2F1", "#8B139D"]
  },
  20: {
    frontBackground: "assets/20-front-background.png",
    backBackground: "assets/20-back-background.png",
    palette: ["#FFFBEF", "#FBE3D5", "#D67F5F", "#A8660F", "#9D270A"]
  },
  50: {
    frontBackground: "assets/50-front-background.png",
    backBackground: "assets/50-back-background.png",
    palette: ["#FCFDFA", "#E3F7F1", "#BCEEE7", "#2B563B", "#215B32"]
  },
  100: {
    frontBackground: "assets/100-front-background.png",
    backBackground: "assets/100-back-background.png",
    palette: ["#FFF3F8", "#FEE7F5", "#F9BBD9", "#FF6097", "#D53B6F"]
  },
};

// Add one object here after adding a registered transparent PNG to assets/.
// All current backgrounds and listed overlays are registered at 1584 × 795.
// Pending clean exports (not included in either selectable pool):
// - assets/huba-front.png contains a baked-in blue denomination "10".
// - assets/night-time-back.png is fully opaque and would cover the background.
const frontMemes = [
  { id: "mushroom-head", name: "Mushroom Head", src: "assets/mushroom-head-front.png" },
  { id: "abstract-three-heads", name: "Abstract Three Heads", src: "assets/abstract-three-heads-front.png" },
  { id: "xiongmao-ren1", name: "Xiongmao Ren", src: "assets/xiongmao-ren1-front.png" },
  { id: "niulai", name: "Niulai", src: "assets/niulai-front.png" },
  { id: "bingchilling", name: "Bingchilling", src: "assets/bingchilling-front.png" },
];
const backMemes = [
  { id: "fashion-buddha", name: "Fashion Buddha", src: "assets/fashion-buddha-back.png" },
  { id: "good-morning", name: "Good Morning", src: "assets/good-morning-back.png" },
  { id: "get-rich", name: "Get Rich", src: "assets/get-rich-back.png" },
  { id: "blanket", name: "Blanket", src: "assets/blanket-back.png" },
  { id: "xiyouji", name: "Xiyouji", src: "assets/xiyouji-back.png" },
];

// Cache promises so simultaneous requests share one load. Failed loads can retry.
const imageCache = new Map();
function loadImage(src) {
  if (!imageCache.has(src)) {
    const loading = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${src}. Check the path and use a local server or GitHub Pages.`));
      image.src = src;
    }).catch(error => {
      imageCache.delete(src);
      console.error(error);
      throw error;
    });
    imageCache.set(src, loading);
  }
  return imageCache.get(src);
}

// Accept a loaded image, or a path for standalone reuse. Only meme overlays
// pass through this function; the finished backgrounds never do.
async function recolorImage(source, palette) {
  const image = typeof source === "string" ? await loadImage(source) : source;
  if (palette.length < 2 || !palette.every(color => /^#[0-9a-f]{6}$/i.test(color))) {
    throw new Error("A palette needs at least two six-digit hex colors.");
  }
  const colors = palette.map(hex => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = pixels.data;

  // Each pixel uses four bytes: red, green, blue, alpha.
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;

    // Weighted luminance also handles slight channel differences in grayscale art.
    const luminance = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    const position = Math.max(0, Math.min(1, 1 - luminance)) * (colors.length - 1);
    const lower = Math.min(Math.floor(position), colors.length - 2);
    const blend = position - lower;

    // Smoothly interpolate between neighboring stops instead of threshold bands.
    for (let channel = 0; channel < 3; channel++) {
      data[i + channel] = Math.round(
        colors[lower][channel] * (1 - blend) + colors[lower + 1][channel] * blend
      );
    }
    // Never write data[i + 3]: original transparency and fades stay intact.
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

async function compositeSide(background, overlay, palette) {
  // Fail clearly rather than silently resizing or misregistering an asset.
  if (background.naturalWidth !== overlay.naturalWidth ||
      background.naturalHeight !== overlay.naturalHeight) {
    throw new Error(`Dimensions do not match: ${overlay.src} (${overlay.naturalWidth} × ${overlay.naturalHeight}) and ${background.src} (${background.naturalWidth} × ${background.naturalHeight}). Export matching registered assets.`);
  }
  const recolored = await recolorImage(overlay, palette);
  const canvas = document.createElement("canvas");
  canvas.width = background.naturalWidth;
  canvas.height = background.naturalHeight;
  const context = canvas.getContext("2d");
  context.drawImage(background, 0, 0);
  context.drawImage(recolored, 0, 0);
  return canvas;
}

// Returns both native-resolution canvases, independently of the page interface.
async function generateBanknote({ denomination, frontMeme, backMeme }) {
  const note = denominations[denomination];
  const front = frontMemes.find(meme => meme.id === frontMeme);
  const back = backMemes.find(meme => meme.id === backMeme);
  if (!note || !front || !back) throw new Error("Unknown denomination or meme ID.");

  const [frontBackground, backBackground, frontOverlay, backOverlay] = await Promise.all([
    loadImage(note.frontBackground), loadImage(note.backBackground),
    loadImage(front.src), loadImage(back.src)
  ]);
  const [frontCanvas, backCanvas] = await Promise.all([
    compositeSide(frontBackground, frontOverlay, note.palette),
    compositeSide(backBackground, backOverlay, note.palette)
  ]);
  return { frontCanvas, backCanvas, front, back };
}

// The three choices are independent. Rendering uses a snapshot of this state.
const state = { denomination: 50, frontMeme: "mushroom-head", backMeme: "fashion-buddha" };
let renderVersion = 0;
let currentResult = null;
const status = document.getElementById("status");
const saveButton = document.getElementById("save");

function syncControls() {
  document.querySelectorAll("[data-denomination]").forEach(button => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.denomination) === state.denomination));
  });
  document.getElementById("front-select").value = state.frontMeme;
  document.getElementById("back-select").value = state.backMeme;
}

async function renderSelection() {
  const version = ++renderVersion;
  const selection = { ...state };
  syncControls();
  saveButton.disabled = true;
  status.classList.remove("error");
  status.textContent = "Generating front and back…";
  document.querySelector(".preview-area").setAttribute("aria-busy", "true");
  try {
    const result = await generateBanknote(selection);
    // A slow earlier load must never overwrite a newer selection.
    if (version !== renderVersion) return;
    for (const side of ["front", "back"]) {
      const preview = document.getElementById(`${side}-canvas`);
      const generated = result[`${side}Canvas`];
      preview.width = generated.width;
      preview.height = generated.height;
      preview.getContext("2d").drawImage(generated, 0, 0);
      preview.setAttribute("aria-label", `¥${selection.denomination} banknote ${side} with ${result[side].name} artwork`);
      preview.hidden = false;
    }
    currentResult = { ...result, selection };
    document.getElementById("denomination").textContent = `¥${selection.denomination}`;
    document.getElementById("front-meme").textContent = result.front.name;
    document.getElementById("back-meme").textContent = result.back.name;
    status.textContent = "Front and back generated at native resolution.";
    saveButton.disabled = false;
  } catch (error) {
    console.error(error);
    if (version !== renderVersion) return;
    status.textContent = `Unable to generate: ${error.message} Choose another selection to retry.`;
    status.classList.add("error");
    // Avoid showing old notes as though they belong to the failed selection.
    currentResult = null;
    document.querySelectorAll(".preview-area canvas").forEach(canvas => { canvas.hidden = true; });
  } finally {
    if (version === renderVersion) document.querySelector(".preview-area").setAttribute("aria-busy", "false");
  }
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

async function saveBanknote() {
  if (!currentResult || saveButton.disabled) return;
  // Capture exactly the completed pair, even if selections change during export.
  const { frontCanvas, backCanvas, selection } = currentResult;
  const output = document.createElement("canvas");
  const gap = 24; // Native output pixels, independent of preview CSS.
  output.width = Math.max(frontCanvas.width, backCanvas.width);
  output.height = frontCanvas.height + gap + backCanvas.height;
  const context = output.getContext("2d");
  context.drawImage(frontCanvas, (output.width - frontCanvas.width) / 2, 0);
  context.drawImage(backCanvas, (output.width - backCanvas.width) / 2, frontCanvas.height + gap);
  try {
    const blob = await new Promise((resolve, reject) => {
      output.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed.")), "image/png");
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `meme-bank-${selection.denomination}-${selection.frontMeme}-${selection.backMeme}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.error(error);
    status.textContent = `Unable to save: ${error.message}`;
    status.classList.add("error");
  }
}

function initializePrototype() {
  const denominationButtons = document.getElementById("denomination-buttons");
  for (const denomination of Object.keys(denominations)) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = denomination;
    button.dataset.denomination = denomination;
    button.setAttribute("aria-label", `¥${denomination}`);
    button.addEventListener("click", () => {
      state.denomination = Number(denomination);
      renderSelection();
    });
    denominationButtons.append(button);
  }
  for (const [side, memes] of [["front", frontMemes], ["back", backMemes]]) {
    const select = document.getElementById(`${side}-select`);
    for (const meme of memes) {
      const option = document.createElement("option");
      option.value = meme.id;
      option.textContent = meme.name;
      select.append(option);
    }
    select.addEventListener("change", () => {
      state[`${side}Meme`] = select.value;
      renderSelection();
    });
  }
  document.getElementById("regenerate").addEventListener("click", () => {
    state.denomination = Number(randomItem(Object.keys(denominations)));
    state.frontMeme = randomItem(frontMemes).id;
    state.backMeme = randomItem(backMemes).id;
    renderSelection();
  });
  saveButton.addEventListener("click", saveBanknote);
  renderSelection();
}

initializePrototype();
