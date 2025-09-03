class PopupController {
  constructor() {
    this.init();
  }

  async init() {
    this.setupElements();
    this.setupEventListeners();
    await this.loadState();
  }

  setupElements() {
    this.uploadArea = document.getElementById("uploadArea");
    this.fileInput = document.getElementById("fileInput");
    this.currentImageContainer = document.getElementById("currentImageContainer");
    this.currentImage = document.getElementById("currentImage");
    this.controls = document.getElementById("controls");
    this.opacitySlider = document.getElementById("opacitySlider");
    this.opacityValue = document.getElementById("opacityValue");
    this.sizeSlider = document.getElementById("sizeSlider");
    this.sizeValue = document.getElementById("sizeValue");
    this.toggleBtn = document.getElementById("toggleBtn");
    this.freezeBtn = document.getElementById("freezeBtn");
    this.resetBtn = document.getElementById("resetBtn");
    this.status = document.getElementById("status");
  }

  setupEventListeners() {
    this.uploadArea.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", (e) => this.handleFileSelect(e));

    this.uploadArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.uploadArea.classList.add("dragover");
    });

    this.uploadArea.addEventListener("dragleave", () => {
      this.uploadArea.classList.remove("dragover");
    });

    this.uploadArea.addEventListener("drop", (e) => {
      e.preventDefault();
      this.uploadArea.classList.remove("dragover");
      this.handleFileSelect(e);
    });

    this.opacitySlider.addEventListener("input", () => this.updateOpacity());
    this.sizeSlider.addEventListener("input", () => this.updateSize());
    this.toggleBtn.addEventListener("click", () => this.toggleOverlay());
    this.freezeBtn.addEventListener("click", () => this.toggleFreeze());
    this.resetBtn.addEventListener("click", () => this.resetPosition());
  }

  async handleFileSelect(e) {
    const files = e.target.files || e.dataTransfer.files;
    if (!files.length) return;

    const file = files[0];
    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecione um arquivo de imagem válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target.result;
      await this.saveImageData(imageData);
      this.displayCurrentImage(imageData);
      this.controls.style.display = "block";
    };
    reader.readAsDataURL(file);
  }

  displayCurrentImage(imageData) {
    this.currentImage.src = imageData;
    this.currentImageContainer.style.display = "block";
  }

  async updateOpacity() {
    const value = this.opacitySlider.value;
    this.opacityValue.textContent = `${value}%`;
    await this.saveState({ opacity: value });
    this.sendMessage({ action: "updateOpacity", opacity: value / 100 });
  }

  async updateSize() {
    const value = this.sizeSlider.value;
    this.sizeValue.textContent = `${value}%`;
    await this.saveState({ scale: value });
    this.sendMessage({ action: "updateSize", scale: value / 100 });
  }

  async toggleOverlay() {
    const currentState = await this.getState();
    const newActive = !currentState.active;

    await this.saveState({ active: newActive });
    this.updateUI();
    this.sendMessage({
      action: newActive ? "showOverlay" : "hideOverlay",
      imageData: currentState.imageData,
    });
  }

  async toggleFreeze() {
    const currentState = await this.getState();
    const newFrozen = !currentState.frozen;

    await this.saveState({ frozen: newFrozen });
    this.updateUI();
    this.sendMessage({ action: "toggleFreeze", frozen: newFrozen });
  }

  async resetPosition() {
    await this.saveState({ position: { x: 50, y: 50 } });

    const state = await this.getState();
    if (state.active) {
      this.sendMessage({ action: "resetPosition" });
    }
  }

  async saveImageData(imageData) {
    await this.saveState({ imageData, active: false });
  }

  async saveState(newState) {
    const currentState = await this.getState();
    const updatedState = { ...currentState, ...newState };
    await chrome.storage.local.set({ overlayState: updatedState });
  }

  async getState() {
    const result = await chrome.storage.local.get("overlayState");
    return (
      result.overlayState || {
        imageData: null,
        active: false,
        frozen: false,
        opacity: 80,
        scale: 100,
        position: { x: 50, y: 50 },
      }
    );
  }

  async loadState() {
    const state = await this.getState();

    this.opacitySlider.value = state.opacity;
    this.opacityValue.textContent = `${state.opacity}%`;
    this.sizeSlider.value = state.scale;
    this.sizeValue.textContent = `${state.scale}%`;

    if (state.imageData) {
      this.displayCurrentImage(state.imageData);
      this.controls.style.display = "block";
    }

    this.updateUI();
  }

  async updateUI() {
    const state = await this.getState();

    if (state.active) {
      this.toggleBtn.textContent = "Desativar";
      this.toggleBtn.classList.add("active");
      this.status.textContent = "Overlay Ativo";
      this.status.className = "status active";
    } else {
      this.toggleBtn.textContent = "Ativar";
      this.toggleBtn.classList.remove("active");
      this.status.textContent = "Overlay Desativado";
      this.status.className = "status inactive";
    }

    if (state.frozen) {
      this.freezeBtn.textContent = "Descongelar";
      this.freezeBtn.classList.add("active");
    } else {
      this.freezeBtn.textContent = "Congelar";
      this.freezeBtn.classList.remove("active");
    }
  }

  sendMessage(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, message);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new PopupController();
});
