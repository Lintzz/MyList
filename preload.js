const { contextBridge, ipcRenderer } = require("electron");

window.addEventListener("DOMContentLoaded", async () => {
  try {
    const settings = await ipcRenderer.invoke("carregar-settings");
    const theme = settings.theme || "theme-dark";
    const accentColor = settings.accentColor || "blue";
    const listDensity = settings.listDensity || "default";

    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.listDensity = listDensity;
    document.documentElement.style.setProperty(
      "--accent-color",
      `var(--accent-color-${accentColor})`
    );
  } catch (error) {
    console.error("Falha ao aplicar o tema no pré-carregamento:", error);
  }
});

contextBridge.exposeInMainWorld("electronAPI", {
  // Funções de Navegação
  navigateToHub: () => ipcRenderer.send("navigate-to-hub"),
  logout: () => ipcRenderer.send("logout"),
  navigateToSettings: () => ipcRenderer.send("navigate-to-settings"),
  navigateToChangelog: () => ipcRenderer.send("navigate-to-changelog"),
  navigateToMain: () => ipcRenderer.send("navigate-to-main"),
  navigateBack: () => ipcRenderer.send("navigate-back"),
  navigateToConfirmRegister: () =>
    ipcRenderer.send("navigate-to-confirm-register"),
  navigateToList: (options) => {
    let mediaType, initialTab;
    if (typeof options === "string") {
      mediaType = options;
      initialTab = null;
    } else {
      mediaType = options.mediaType;
      initialTab = options.initialTab;
    }
    ipcRenderer.send("navigate-to-list", { mediaType, initialTab });
  },
  navigateToProfile: () => ipcRenderer.send("navigate-to-profile"),
  navigateToFriends: () => ipcRenderer.send("navigate-to-friends"),
  getInitialTab: () => ipcRenderer.invoke("get-initial-tab"),
  navigateToUserProfile: (userId) =>
    ipcRenderer.send("navigate-to-user-profile", userId),
  navigateToCompare: (friendId) =>
    ipcRenderer.send("navigate-to-compare", friendId),
  getUserIdToView: () => ipcRenderer.invoke("get-userId-to-view"),

  // Funções Seguras de API
  searchMedia: (mediaType, term) =>
    ipcRenderer.invoke("search-media", { mediaType, term }),
  getMediaDetails: (mediaType, id) =>
    ipcRenderer.invoke("get-media-details", { mediaType, id }),
  getTrendingMedia: (mediaType) =>
    ipcRenderer.invoke("get-trending-media", { mediaType }),
  getRandomMedia: (mediaType) =>
    ipcRenderer.invoke("get-random-media", { mediaType }),

  // Funções de Configuração e Dados
  getListType: () => ipcRenderer.invoke("get-list-type"),
  getFirebaseConfig: () => ipcRenderer.invoke("get-firebase-config"),
  loadSettings: () => ipcRenderer.invoke("carregar-settings"),
  saveSettings: (settings) => ipcRenderer.send("salvar-settings", settings),
  importarJson: () => ipcRenderer.invoke("importar-json"),
  exportarJson: (dados) => ipcRenderer.invoke("exportar-json", dados),
  saveShareImage: (dataUrl) => ipcRenderer.invoke("save-share-image", dataUrl),

  // Notificações
  sendNotificationUpdate: (count) =>
    ipcRenderer.send("notification-update", count),

  // Links Externos e Deep Link
  openExternalLink: (url) => ipcRenderer.send("open-external-link", url),
  handleDeepLink: (callback) =>
    ipcRenderer.on("deep-link-received", (event, url) => callback(url)),

  // Controles da Janela e Ciclo de Vida
  readyToShow: () => ipcRenderer.send("ready-to-show"),
  minimizeWindow: () => ipcRenderer.send("minimize-window"),
  maximizeWindow: () => ipcRenderer.send("maximize-window"),
  closeWindow: () => ipcRenderer.send("close-window"),

  // Funções do Modal de Atualização
  onUpdateModalInfo: (callback) =>
    ipcRenderer.on("update-modal-info", (event, info) => callback(info)),
  closeUpdateModal: () => ipcRenderer.send("close-update-modal"),
  installUpdate: () => ipcRenderer.send("install-update"),

  // Atualizações do App
  onUpdateReady: (callback) => ipcRenderer.on("update-ready", () => callback()),
  quitAndInstallUpdate: () => ipcRenderer.send("quit-and-install-update"),
});
