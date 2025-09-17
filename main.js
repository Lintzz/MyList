const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  shell,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const log = require("electron-log");
const fetch = require("node-fetch");
require("dotenv").config({ path: path.join(app.getAppPath(), ".env") });

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

let mainWindow;
let currentMediaType = null;
let lastActiveView = null;
let initialTabOnLoad = null;
let userIdToView = null;
let navigationHistory = [];
let updateWindow = null;

const apiCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutos de cache

const API_KEYS = {
  comicVine: process.env.COMIC_VINE_API_KEY,
  tmdb: process.env.TMDB_API_KEY,
  giantBomb: process.env.GIANT_BOMB_API_KEY,
};

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};

// --- Controle de Rate Limit da API Jikan (Versão Robusta) ---
const JIKAN_API_HOST = "api.jikan.moe";
const REQUEST_DELAY = 1100; // Atraso de 1100ms (pouco menos de 1 req/s para segurança)
let jikanRequestQueue = [];
let isJikanQueueProcessing = false;

async function processJikanQueue() {
  if (jikanRequestQueue.length === 0) {
    isJikanQueueProcessing = false;
    return;
  }

  isJikanQueueProcessing = true;
  const { url, options, bypassCache, resolve, reject } =
    jikanRequestQueue.shift();

  try {
    const result = await performFetch(url, options, bypassCache);
    resolve(result);
  } catch (error) {
    reject(error);
  }

  setTimeout(() => {
    isJikanQueueProcessing = false;
    processJikanQueue();
  }, REQUEST_DELAY);
}

function enqueueJikanRequest(url, options, bypassCache) {
  return new Promise((resolve, reject) => {
    jikanRequestQueue.push({ url, options, bypassCache, resolve, reject });
    if (!isJikanQueueProcessing) {
      processJikanQueue();
    }
  });
}
// --- Fim do Controle de Rate Limit ---

// Função de fetch que será chamada pela fila ou diretamente
async function performFetch(url, options = {}, bypassCache = false) {
  const cacheKey = url;
  if (!bypassCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.data;
    }
  }
  try {
    const finalOptions = {
      ...options,
      headers: { ...options.headers, "User-Agent": "MyListDesktopApp/1.0" },
    };
    const response = await fetch(url, finalOptions);
    if (!response.ok) {
      const errorBody = await response.text();
      log.error(
        `HTTP error! status: ${response.status}, for url: ${url}, body: ${errorBody}`
      );
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.error && data.error.toUpperCase() !== "OK") {
      log.error("API Error (não OK):", data.error);
      return { error: true, message: `Erro da API Externa: ${data.error}` };
    }
    if (!bypassCache) {
      apiCache.set(cacheKey, { data, timestamp: Date.now() });
    }
    return data;
  } catch (error) {
    log.error("API Fetch Error:", url, error);
    return {
      error: true,
      message: error.message || "An unknown network error occurred",
    };
  }
}

// Função principal que decide se a requisição vai para a fila ou direto
function fetchData(url, options, bypassCache) {
  if (url.includes(JIKAN_API_HOST)) {
    return enqueueJikanRequest(url, options, bypassCache);
  }
  return performFetch(url, options, bypassCache);
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("minha-lista", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("minha-lista");
}

function broadcastDeepLink(url) {
  if (!url || !url.startsWith("minha-lista://")) return;
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("deep-link-received", url);
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    const deepLinkUrl = commandLine.find((arg) =>
      arg.startsWith("minha-lista://")
    );
    broadcastDeepLink(deepLinkUrl);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createPatchNotesWindow() {
  const patchNotesWindow = new BrowserWindow({
    width: 830,
    height: 900,
    title: "Novidades da Versão",
    icon: path.join(__dirname, "src/assets/icon.ico"),
    autoHideMenuBar: true,
    frame: false,
    parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  patchNotesWindow.loadFile(path.join(__dirname, "src/html/patch-notes.html"));
  patchNotesWindow.once("ready-to-show", () => {
    patchNotesWindow.show();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 880,
    height: 950,
    minWidth: 880,
    minHeight: 500,
    frame: false,
    show: false,
    backgroundColor: "#121212",
    icon: path.join(__dirname, "src/assets/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  //mainWindow.webContents.openDevTools();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.loadFile(path.join(__dirname, "src/html/login.html"));

  mainWindow.webContents.once("dom-ready", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
    autoUpdater.checkForUpdates();
  });

  const deepLinkOnStartup = process.argv.find((arg) =>
    arg.startsWith("minha-lista://")
  );
  if (deepLinkOnStartup) {
    mainWindow.webContents.once("dom-ready", () => {
      broadcastDeepLink(deepLinkOnStartup);
    });
  }
}

function createUpdateWindow() {
  if (updateWindow) {
    updateWindow.focus();
    return;
  }

  const parentBounds = mainWindow.getBounds();
  const modalWidth = 500;
  const modalHeight = 150;

  updateWindow = new BrowserWindow({
    width: modalWidth,
    height: modalHeight,
    x: Math.round(parentBounds.x + parentBounds.width / 2 - modalWidth / 2),
    y: Math.round(parentBounds.y + parentBounds.height - modalHeight - 20),
    parent: mainWindow,
    modal: true, // MODIFICADO
    frame: false,
    transparent: true,
    show: false,
    resizable: false,
    movable: false,
    alwaysOnTop: false, // MODIFICADO
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  updateWindow.loadFile(path.join(__dirname, "src/html/update-modal.html"));

  const onMove = () => {
    if (updateWindow && !updateWindow.isDestroyed()) {
      const newParentBounds = mainWindow.getBounds();
      updateWindow.setBounds({
        x: Math.round(
          newParentBounds.x + newParentBounds.width / 2 - modalWidth / 2
        ),
        y: Math.round(
          newParentBounds.y + newParentBounds.height - modalHeight - 20
        ),
      });
    }
  };
  mainWindow.on("move", onMove);

  updateWindow.webContents.on("did-finish-load", async () => {
    const settingsFilePath = path.join(
      app.getPath("userData"),
      "settings.json"
    );
    let settings = {};
    try {
      if (fs.existsSync(settingsFilePath)) {
        settings = JSON.parse(fs.readFileSync(settingsFilePath, "utf8"));
      }
    } catch (error) {
      log.error("Could not read settings file for update modal", error);
    }
    updateWindow.webContents.send("update-modal-info", settings);
  });

  updateWindow.once("ready-to-show", () => {
    updateWindow.show();
  });

  updateWindow.on("closed", () => {
    mainWindow.removeListener("move", onMove);
    updateWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  const userDataPath = app.getPath("userData");
  const lastVersionPath = path.join(userDataPath, "last-version.txt");

  mainWindow.once("ready-to-show", () => {
    try {
      const currentVersion = app.getVersion();
      if (fs.existsSync(lastVersionPath)) {
        const lastVersion = fs.readFileSync(lastVersionPath, "utf8");
        if (currentVersion !== lastVersion) {
          createPatchNotesWindow();
          fs.writeFileSync(lastVersionPath, currentVersion, "utf8");
        }
      } else {
        createPatchNotesWindow();
        fs.writeFileSync(lastVersionPath, currentVersion, "utf8");
      }
    } catch (err) {
      log.error("Failed to handle version check for patch notes:", err);
    }
  });
});

app.on("window-all-closed", () => {
  if (updateWindow) {
    updateWindow.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

autoUpdater.on("update-downloaded", () => {
  log.info("Update downloaded; creating update modal window.");
  createUpdateWindow();
});

ipcMain.on("notification-update", (event, count) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("notification-count-update", count);
  }
});

ipcMain.on("close-update-modal", () => {
  if (updateWindow) {
    updateWindow.close();
  }
});

ipcMain.on("install-update", () => {
  autoUpdater.quitAndInstall();
});

function navigateTo(win, file, clearHistory = false) {
  if (!win) return;
  const currentURL = win.webContents.getURL();
  const targetFile = path.join(__dirname, file).replace(/\\/g, "/");

  if (currentURL && !currentURL.endsWith(targetFile)) {
    navigationHistory.push(currentURL);
  }
  if (clearHistory) {
    navigationHistory = [];
  }
  win.loadFile(path.join(__dirname, file));
}

ipcMain.on("quit-and-install-update", () => autoUpdater.quitAndInstall());

ipcMain.on("ready-to-show", () => {
  log.info("Content is ready to be shown.");
});

ipcMain.on("open-external-link", (event, url) => shell.openExternal(url));

ipcMain.on("navigate-to-hub", (event) => {
  navigateTo(
    BrowserWindow.fromWebContents(event.sender),
    "src/html/hub.html",
    true
  );
});

ipcMain.on("navigate-to-list", (event, { mediaType, initialTab }) => {
  currentMediaType = mediaType;
  initialTabOnLoad = initialTab || null;
  navigateTo(
    BrowserWindow.fromWebContents(event.sender),
    "src/html/list-view.html",
    true
  );
});

ipcMain.handle("get-list-type", () => currentMediaType);
ipcMain.handle("get-initial-tab", () => {
  const tab = initialTabOnLoad;
  initialTabOnLoad = null;
  return tab;
});

ipcMain.on("navigate-to-settings", (event) => {
  navigateTo(
    BrowserWindow.fromWebContents(event.sender),
    "src/html/settings.html"
  );
});

ipcMain.on("navigate-to-changelog", (event) => {
  const changelogWindow = new BrowserWindow({
    width: 830,
    height: 900,
    title: "Histórico de Versões",
    icon: path.join(__dirname, "src/assets/icon.ico"),
    autoHideMenuBar: true,
    parent: mainWindow,
    modal: true,
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });
  changelogWindow.loadFile(path.join(__dirname, "src/html/historico.html"));
  changelogWindow.once("ready-to-show", () => {
    changelogWindow.show();
  });
});

ipcMain.on("navigate-to-profile", (event) => {
  navigateTo(
    BrowserWindow.fromWebContents(event.sender),
    "src/html/profile.html"
  );
});

ipcMain.on("navigate-to-user-profile", (event, userId) => {
  userIdToView = userId;
  navigateTo(
    BrowserWindow.fromWebContents(event.sender),
    "src/html/user-profile.html"
  );
});

ipcMain.on("navigate-to-compare", (event, friendId) => {
  userIdToView = friendId;
  navigateTo(
    BrowserWindow.fromWebContents(event.sender),
    "src/html/compare-friends.html"
  );
});

ipcMain.handle("get-userId-to-view", () => userIdToView);

ipcMain.on("navigate-to-friends", (event) => {
  navigateTo(
    BrowserWindow.fromWebContents(event.sender),
    "src/html/friends.html"
  );
});

ipcMain.on("navigate-back", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (navigationHistory.length > 0) {
      const lastUrl = navigationHistory.pop();
      win.loadURL(lastUrl);
    } else {
      navigateTo(win, "src/html/hub.html", true);
    }
  }
});

ipcMain.on("navigate-to-main", (event) => {
  navigateTo(
    BrowserWindow.fromWebContents(event.sender),
    "src/html/login.html",
    true
  );
});

ipcMain.on("navigate-to-confirm-register", (event) => {
  navigateTo(
    BrowserWindow.fromWebContents(event.sender),
    "src/html/confirm-register.html",
    true
  );
});

ipcMain.on("logout", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    session.defaultSession.clearStorageData().then(() => {
      navigateTo(win, "src/html/login.html", true);
    });
  }
});

ipcMain.on("minimize-window", (event) =>
  BrowserWindow.fromWebContents(event.sender)?.minimize()
);
ipcMain.on("maximize-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on("close-window", () => app.quit());

ipcMain.handle("get-firebase-config", () => {
  return FIREBASE_CONFIG;
});
ipcMain.handle("carregar-settings", async () => {
  const settingsFilePath = path.join(app.getPath("userData"), "settings.json");
  const systemLang = app.getLocale().startsWith("pt") ? "pt" : "en";
  let defaultConfig = {
    theme: "theme-dark",
    accentColor: "blue",
    language: systemLang,
    listOrder: [
      "anime",
      "manga",
      "movies",
      "series",
      "comics",
      "books",
      "games",
    ],
    listVisibility: {
      anime: true,
      manga: true,
      movies: true,
      series: true,
      comics: true,
      books: true,
      games: true,
    },
  };
  try {
    if (fs.existsSync(settingsFilePath)) {
      const fileData = fs.readFileSync(settingsFilePath, "utf8");
      const savedSettings = JSON.parse(fileData);
      return { ...defaultConfig, ...savedSettings };
    } else {
      fs.writeFileSync(
        settingsFilePath,
        JSON.stringify(defaultConfig, null, 2)
      );
      return defaultConfig;
    }
  } catch (error) {
    log.error("Falha ao carregar ou criar configurações:", error);
    return defaultConfig;
  }
});
ipcMain.on("salvar-settings", (event, settings) => {
  const settingsFilePath = path.join(app.getPath("userData"), "settings.json");
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
  } catch (error) {
    log.error("Falha ao salvar configurações:", error);
  }
});
ipcMain.handle("importar-json", async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openFile"],
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (canceled || filePaths.length === 0) return null;
    const fileData = fs.readFileSync(filePaths[0], "utf8");
    return JSON.parse(fileData);
  } catch (error) {
    log.error("Falha ao importar JSON:", error);
    return null;
  }
});
ipcMain.handle("exportar-json", async (event, dados) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Salvar Backup da Lista",
      defaultPath: `backup_lista_${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "JSON Files", extensions: ["json"] }],
    });
    if (canceled || !filePath)
      return { success: false, message: "Exportação cancelada." };
    fs.writeFileSync(filePath, JSON.stringify(dados, null, 2), "utf-8");
    return { success: true };
  } catch (error) {
    log.error("Falha ao exportar JSON:", error);
    return { success: false, message: "Falha ao exportar arquivo." };
  }
});
ipcMain.handle("save-share-image", async (event, dataUrl) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "Salvar Estatísticas",
    defaultPath: "minhas-estatisticas-mylist.png",
    filters: [{ name: "Imagens PNG", extensions: ["png"] }],
  });
  if (!canceled && filePath) {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync(filePath, base64Data, "base64");
    return { success: true, path: filePath };
  }
  return { success: false };
});
ipcMain.handle("search-media", async (event, { mediaType, term }) => {
  let url;
  switch (mediaType) {
    case "anime":
      url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(term)}`;
      const animeData = await fetchData(url);
      if (animeData.data) {
        animeData.data = animeData.data.filter((item) => item.type !== "Movie");
      }
      return animeData;
    case "manga":
      url = `https://api.jikan.moe/v4/manga?q=${encodeURIComponent(term)}`;
      break;
    case "movies":
      url = `https://api.themoviedb.org/3/search/multi?api_key=${
        API_KEYS.tmdb
      }&query=${encodeURIComponent(term)}&language=pt-BR`;
      break;
    case "series":
      url = `https://api.themoviedb.org/3/search/tv?api_key=${
        API_KEYS.tmdb
      }&query=${encodeURIComponent(term)}&language=pt-BR`;
      break;
    case "comics":
      url = `https://comicvine.gamespot.com/api/search/?api_key=${
        API_KEYS.comicVine
      }&format=json&resources=volume&query=${encodeURIComponent(
        term
      )}&field_list=id,name,image,publisher,start_year`;
      break;
    case "books":
      url = `https://openlibrary.org/search.json?q=${encodeURIComponent(term)}`;
      break;
    case "games":
      url = `https://www.giantbomb.com/api/search/?api_key=${
        API_KEYS.giantBomb
      }&format=json&query=${encodeURIComponent(
        term
      )}&resources=game&field_list=guid,name,image`;
      break;
    default:
      return { error: true, message: "Invalid media type" };
  }
  return fetchData(url);
});
ipcMain.handle("get-media-details", async (event, { mediaType, id }) => {
  let url;
  switch (mediaType) {
    case "anime":
      url = `https://api.jikan.moe/v4/anime/${id}/full`;
      break;
    case "manga":
      url = `https://api.jikan.moe/v4/manga/${id}/full`;
      break;
    case "movies":
    case "movie":
      url = `https://api.themoviedb.org/3/movie/${id}?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      break;
    case "collection":
      url = `https://api.themoviedb.org/3/collection/${id}?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      break;
    case "series":
      url = `https://api.themoviedb.org/3/tv/${id}?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      break;
    case "comics":
      url = `https://comicvine.gamespot.com/api/volume/4050-${id}/?api_key=${API_KEYS.comicVine}&format=json&field_list=id,name,image,publisher,description,issues,start_year`;
      break;
    case "books":
      url = `https://openlibrary.org${id}.json`;
      break;
    case "games":
      url = `https://www.giantbomb.com/api/game/${id}/?api_key=${API_KEYS.giantBomb}&format=json&field_list=guid,name,image,platforms,deck,original_release_date,genres`;
      break;
    default:
      log.error(`[DETAILS] Tipo de mídia inválido: ${mediaType}`);
      return { error: true, message: "Invalid media type" };
  }
  return fetchData(url);
});
ipcMain.handle("get-trending-media", async (event, { mediaType }) => {
  let url;
  const today = new Date();
  const lastYear = new Date(
    today.getFullYear() - 1,
    today.getMonth(),
    today.getDate()
  )
    .toISOString()
    .split("T")[0];
  switch (mediaType) {
    case "anime":
      url = `https://api.jikan.moe/v4/top/anime`;
      return fetchData(url);
    case "manga":
      url = `https://api.jikan.moe/v4/top/manga`;
      return fetchData(url);
    case "movies":
      url = `https://api.themoviedb.org/3/trending/movie/week?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      const dataMovies = await fetchData(url);
      if (dataMovies && dataMovies.results)
        dataMovies.results.forEach((item) => (item.type = "movie"));
      return dataMovies;
    case "series":
      url = `https://api.themoviedb.org/3/trending/tv/week?api_key=${API_KEYS.tmdb}&language=pt-BR`;
      const dataSeries = await fetchData(url);
      if (dataSeries && dataSeries.results)
        dataSeries.results.forEach((item) => (item.type = "series"));
      return dataSeries;
    case "comics":
      url = `https://comicvine.gamespot.com/api/volumes/?api_key=${API_KEYS.comicVine}&format=json&sort=date_added:desc&limit=20&field_list=id,name,image,publisher,start_year`;
      return fetchData(url);
    case "books":
      url = `https://openlibrary.org/subjects/fiction.json?limit=20`;
      return fetchData(url);
    case "games":
      url = `https://www.giantbomb.com/api/games/?api_key=${
        API_KEYS.giantBomb
      }&format=json&filter=original_release_date:${lastYear}|${
        today.toISOString().split("T")[0]
      }&sort=number_of_user_reviews:desc&limit=20&field_list=guid,name,image`;
      return fetchData(url);
    default:
      return {
        error: true,
        message: "Trending not available for this media type",
      };
  }
});
ipcMain.handle("get-random-media", async (event, { mediaType }) => {
  const randomPage = Math.floor(Math.random() * 100) + 1;

  // Função para embaralhar e pegar os 8 primeiros
  const shuffleAndPick = (array, count = 8) => {
    if (!array || !Array.isArray(array)) return [];
    return [...array].sort(() => 0.5 - Math.random()).slice(0, count);
  };

  switch (mediaType) {
    case "anime":
      const animeData = [];
      let animeAttempts = 0;
      const maxAnimeAttempts = 20;

      while (animeData.length < 8 && animeAttempts < maxAnimeAttempts) {
        const result = await fetchData(
          `https://api.jikan.moe/v4/random/anime`,
          {},
          true
        );
        animeAttempts++;
        if (result && result.data) {
          const anime = result.data;
          if (anime.type !== "Movie" && anime.type !== "Music") {
            animeData.push(anime);
          }
        }
      }
      return { data: animeData };

    case "manga":
      const mangaPromises = Array.from({ length: 8 }, () =>
        fetchData(`https://api.jikan.moe/v4/random/manga`, {}, true)
      );
      try {
        const results = await Promise.all(mangaPromises);
        return { data: results.map((res) => res.data).filter(Boolean) };
      } catch (error) {
        return { error: true, message: error.message };
      }

    case "movies":
      const movieData = await fetchData(
        `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEYS.tmdb}&language=pt-BR&sort_by=popularity.desc&page=${randomPage}`
      );
      if (movieData && movieData.results) {
        movieData.results = shuffleAndPick(movieData.results);
      }
      return movieData;

    case "series":
      const seriesData = await fetchData(
        `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEYS.tmdb}&language=pt-BR&sort_by=popularity.desc&page=${randomPage}`
      );
      if (seriesData && seriesData.results) {
        seriesData.results = shuffleAndPick(seriesData.results);
      }
      return seriesData;

    case "comics":
      const comicPromises = Array.from({ length: 8 }, async () => {
        const initialUrl = `https://comicvine.gamespot.com/api/volumes/?api_key=${API_KEYS.comicVine}&format=json&limit=1`;
        const initialData = await fetchData(initialUrl);
        const totalResults = initialData.number_of_total_results;
        if (!totalResults) return null;
        const randomOffset = Math.floor(Math.random() * totalResults);
        const randomUrl = `https://comicvine.gamespot.com/api/volumes/?api_key=${API_KEYS.comicVine}&format=json&limit=1&offset=${randomOffset}&field_list=id,name,image,publisher,start_year`;
        const randomData = await fetchData(randomUrl);
        return randomData?.results?.[0];
      });
      try {
        const results = await Promise.all(comicPromises);
        return { results: results.filter(Boolean) };
      } catch (error) {
        return { error: true, message: error.message };
      }

    case "books":
      const randomOffsetBooks = Math.floor(Math.random() * 1000);
      const bookData = await fetchData(
        `https://openlibrary.org/subjects/love.json?limit=50&offset=${randomOffsetBooks}`
      );
      if (bookData && bookData.works) {
        bookData.results = shuffleAndPick(bookData.works);
        delete bookData.works; // Limpa a chave original para consistência
      }
      return bookData;

    case "games":
      const gamePromises = Array.from({ length: 8 }, async () => {
        const countUrl = `https://www.giantbomb.com/api/games/?api_key=${API_KEYS.giantBomb}&format=json&limit=1&field_list=id`;
        const countData = await fetchData(countUrl);
        if (!countData.number_of_total_results) return null;
        const totalGames = countData.number_of_total_results;
        const randomOffset = Math.floor(Math.random() * totalGames);
        const randomGameUrl = `https://www.giantbomb.com/api/games/?api_key=${API_KEYS.giantBomb}&format=json&limit=1&offset=${randomOffset}&field_list=guid,name,image,deck,original_release_date,platforms,genres`;
        const randomGameData = await fetchData(randomGameUrl);
        return randomGameData?.results?.[0];
      });
      try {
        const results = await Promise.all(gamePromises);
        return { results: results.filter(Boolean) };
      } catch (error) {
        return { error: true, message: error.message };
      }

    default:
      return {
        error: true,
        message: "Random not available for this media type",
      };
  }
});
