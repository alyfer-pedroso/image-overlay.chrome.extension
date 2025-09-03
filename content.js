class ImageOverlay {
  constructor() {
    this.overlay = null;
    this.isDragging = false;
    this.isResizing = false;
    this.startX = 0;
    this.startY = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    this.init();
  }

  async init() {
    this.createOverlay();
    this.setupEventListeners();
    await this.loadState();
  }

  createOverlay() {
    if (this.overlay) {
      this.overlay.remove();
    }

    this.overlay = document.createElement("div");
    this.overlay.id = "image-overlay-container";
    this.overlay.innerHTML = `
      <img id="overlay-image" src="" alt="Overlay">
      <div class="resize-handles">
        <div class="resize-handle nw"></div>
        <div class="resize-handle ne"></div>
        <div class="resize-handle sw"></div>
        <div class="resize-handle se"></div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.overlayImage = this.overlay.querySelector("#overlay-image");
  }

  setupEventListeners() {
    this.overlay.addEventListener("mousedown", (e) => this.startDrag(e));
    document.addEventListener("mousemove", (e) => this.drag(e));
    document.addEventListener("mouseup", () => this.stopDrag());

    const handles = this.overlay.querySelectorAll(".resize-handle");
    handles.forEach((handle) => {
      handle.addEventListener("mousedown", (e) => this.startResize(e));
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message);
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging || this.isResizing) {
        this.saveCurrentState();
      }
    });
  }

  startDrag(e) {
    if (e.target.classList.contains("resize-handle")) return;
    if (this.overlay.classList.contains("frozen")) return;

    e.preventDefault();
    this.isDragging = true;
    this.overlay.classList.add("dragging");

    const rect = this.overlay.getBoundingClientRect();
    this.startX = e.clientX - rect.left;
    this.startY = e.clientY - rect.top;

    document.body.style.userSelect = "none";
  }

  drag(e) {
    if (!this.isDragging) return;

    e.preventDefault();
    const x = e.clientX - this.startX;
    const y = e.clientY - this.startY;

    const maxX = window.innerWidth - this.overlay.offsetWidth;
    const maxY = window.innerHeight - this.overlay.offsetHeight;

    const boundedX = Math.max(0, Math.min(x, maxX));
    const boundedY = Math.max(0, Math.min(y, maxY));

    this.overlay.style.left = `${boundedX}px`;
    this.overlay.style.top = `${boundedY}px`;
  }

  stopDrag() {
    if (this.isDragging) {
      this.isDragging = false;
      this.overlay.classList.remove("dragging");
      document.body.style.userSelect = "";
    }
    if (this.isResizing) {
      this.isResizing = false;
      this.overlay.classList.remove("resizing");
      document.body.style.userSelect = "";
    }
  }

  startResize(e) {
    if (this.overlay.classList.contains("frozen")) return;

    e.preventDefault();
    e.stopPropagation();

    this.isResizing = true;
    this.overlay.classList.add("resizing");
    this.resizeType = e.target.classList[1];

    const rect = this.overlay.getBoundingClientRect();
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startWidth = rect.width;
    this.startHeight = rect.height;
    this.startLeft = rect.left;
    this.startTop = rect.top;

    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", this.resize.bind(this));
  }

  resize(e) {
    if (!this.isResizing) return;

    e.preventDefault();
    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;

    let newWidth = this.startWidth;
    let newHeight = this.startHeight;
    let newLeft = this.startLeft;
    let newTop = this.startTop;

    switch (this.resizeType) {
      case "se":
        newWidth = this.startWidth + deltaX;
        newHeight = this.startHeight + deltaY;
        break;
      case "sw":
        newWidth = this.startWidth - deltaX;
        newHeight = this.startHeight + deltaY;
        newLeft = this.startLeft + deltaX;
        break;
      case "ne":
        newWidth = this.startWidth + deltaX;
        newHeight = this.startHeight - deltaY;
        newTop = this.startTop + deltaY;
        break;
      case "nw":
        newWidth = this.startWidth - deltaX;
        newHeight = this.startHeight - deltaY;
        newLeft = this.startLeft + deltaX;
        newTop = this.startTop + deltaY;
        break;
    }

    newWidth = Math.max(50, newWidth);
    newHeight = Math.max(50, newHeight);

    this.overlay.style.width = `${newWidth}px`;
    this.overlay.style.height = `${newHeight}px`;
    this.overlay.style.left = `${newLeft}px`;
    this.overlay.style.top = `${newTop}px`;
  }

  handleMessage(message) {
    switch (message.action) {
      case "showOverlay":
        this.showOverlay(message.imageData);
        break;
      case "hideOverlay":
        this.hideOverlay();
        break;
      case "updateOpacity":
        this.updateOpacity(message.opacity);
        break;
      case "updateSize":
        this.updateSize(message.scale);
        break;
      case "toggleFreeze":
        this.toggleFreeze(message.frozen);
        break;
      case "resetPosition":
        this.resetPosition();
        break;
    }
  }

  showOverlay(imageData) {
    if (!imageData) return;

    this.overlayImage.src = imageData;
    this.overlay.style.display = "block";
    this.overlay.classList.add("active");
  }

  hideOverlay() {
    this.overlay.style.display = "none";
    this.overlay.classList.remove("active");
  }

  updateOpacity(opacity) {
    this.overlay.style.opacity = opacity;
  }

  updateSize(scale) {
    const baseSize = 200;
    const newSize = baseSize * scale;
    this.overlay.style.width = `${newSize}px`;
    this.overlay.style.height = `${newSize}px`;
  }

  toggleFreeze(frozen) {
    if (frozen) {
      this.overlay.classList.add("frozen");
    } else {
      this.overlay.classList.remove("frozen");
    }
  }

  resetPosition() {
    this.overlay.style.left = "50%";
    this.overlay.style.top = "50%";
    this.overlay.style.transform = "translate(-50%, -50%)";
  }

  async saveCurrentState() {
    const rect = this.overlay.getBoundingClientRect();
    const state = {
      position: {
        x: (rect.left / window.innerWidth) * 100,
        y: (rect.top / window.innerHeight) * 100,
      },
      size: {
        width: rect.width,
        height: rect.height,
      },
    };

    const currentState = await this.getState();
    await chrome.storage.local.set({
      overlayState: { ...currentState, ...state },
    });
  }

  async loadState() {
    const state = await this.getState();

    if (state.imageData && state.active) {
      this.showOverlay(state.imageData);
    }

    if (state.opacity !== undefined) {
      this.updateOpacity(state.opacity / 100);
    }

    if (state.position) {
      const x = (state.position.x / 100) * window.innerWidth;
      const y = (state.position.y / 100) * window.innerHeight;
      this.overlay.style.left = `${x}px`;
      this.overlay.style.top = `${y}px`;
      this.overlay.style.transform = "none";
    }

    if (state.size) {
      this.overlay.style.width = `${state.size.width}px`;
      this.overlay.style.height = `${state.size.height}px`;
    }

    if (state.frozen) {
      this.toggleFreeze(true);
    }
  }

  async getState() {
    const result = await chrome.storage.local.get("overlayState");
    return result.overlayState || {};
  }
}

if (
  window.location.protocol !== "chrome-extension:" &&
  window.location.protocol !== "chrome:" &&
  window.location.protocol !== "about:" &&
  window.location.protocol !== "moz-extension:"
) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      new ImageOverlay();
    });
  } else {
    new ImageOverlay();
  }
}
