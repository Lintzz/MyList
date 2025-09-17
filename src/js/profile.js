import { carregarDadosUsuario } from "./firebase-service.js";

let t;
let auth, db;
let currentUser = null;
let currentUserData = {};
let allListsData = {}; // Guardar os dados de todas as listas

async function applyTranslations(lang) {
  const response = await fetch(`../locales/${lang}.json`);
  const translations = await response.json();

  function translate(key, options = {}) {
    let text =
      key.split(".").reduce((obj, i) => (obj ? obj[i] : null), translations) ||
      key;
    for (const option in options) {
      text = text.replace(`{{${option}}}`, options[option]);
    }
    return text;
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key.startsWith("[") && key.includes("]")) {
      const match = key.match(/\[(.*?)\](.*)/);
      if (match) {
        const attr = match[1];
        const actualKey = match[2];
        element.setAttribute(attr, translate(actualKey));
      }
    } else {
      element.innerHTML = translate(key);
    }
  });
  return translate;
}

function calculateAndRenderOverview(lists) {
  let totalItems = 0;
  let totalCompleted = 0;
  let totalFavorites = 0;
  let totalMinutes = 0;
  let animeMinutes = 0;
  let seriesMinutes = 0;
  let moviesMinutes = 0;

  const timeEstimates = {
    anime: 24,
    series: 45,
    movies: 110,
  };

  for (const mediaType in lists) {
    const list = lists[mediaType] || [];
    totalItems += list.length;
    list.forEach((item) => {
      if (item.isFavorite) {
        totalFavorites++;
      }

      let isFinished = true;
      let watchedEpisodes = 0;
      if (!item.temporadas || item.temporadas.length === 0) {
        isFinished = false;
      } else {
        item.temporadas.forEach((season) => {
          watchedEpisodes += season.watched_episodes || 0;
          if (
            (season.episodes || 0) > 0 &&
            (season.watched_episodes || 0) < season.episodes
          ) {
            isFinished = false;
          }
        });
      }
      if (isFinished) totalCompleted++;

      if (timeEstimates[mediaType]) {
        const itemMinutes = watchedEpisodes * timeEstimates[mediaType];
        totalMinutes += itemMinutes;
        if (mediaType === "anime") animeMinutes += itemMinutes;
        if (mediaType === "series") seriesMinutes += itemMinutes;
        if (mediaType === "movies") moviesMinutes += itemMinutes;
      }
    });
  }

  document.getElementById("total-items").textContent = totalItems;
  document.getElementById("total-completed").textContent = totalCompleted;
  document.getElementById("total-favorites").textContent = totalFavorites;
  document.getElementById("total-time").textContent = `${Math.floor(
    totalMinutes / 60
  )}h`;
  document.getElementById("total-time-animes").textContent = `${Math.floor(
    animeMinutes / 60
  )}h`;
  document.getElementById("total-time-series").textContent = `${Math.floor(
    seriesMinutes / 60
  )}h`;
  document.getElementById("total-time-movies").textContent = `${Math.floor(
    moviesMinutes / 60
  )}h`;
}

function renderFavoritesCarousel(lists) {
  const containers = {
    main: document.getElementById("main-favorites-carousel"),
    anime: document.getElementById("anime-favorites-carousel"),
    manga: document.getElementById("manga-favorites-carousel"),
    movies: document.getElementById("movies-favorites-carousel"),
    series: document.getElementById("series-favorites-carousel"),
    comics: document.getElementById("comics-favorites-carousel"),
    books: document.getElementById("books-favorites-carousel"),
    games: document.getElementById("games-favorites-carousel"),
  };

  const favorites = {
    main: [],
    anime: [],
    manga: [],
    movies: [],
    series: [],
    comics: [],
    books: [],
    games: [],
  };

  for (const mediaType in lists) {
    const list = lists[mediaType] || [];
    list.forEach((item) => {
      if (item.isSuperFavorite) {
        favorites.main.push(item);
      }
      if (item.isFavorite && favorites[mediaType]) {
        favorites[mediaType].push(item);
      }
    });
  }

  const renderCarousel = (container, items) => {
    if (!container) return;

    const section = container.closest(".dashboard-section");

    if (items.length === 0) {
      if (section) section.style.display = "none";
      return;
    }

    if (section) section.style.display = "block";

    container.innerHTML = "";
    items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "favorite-item-card";
      card.innerHTML = `
                <img src="${
                  item.image_url ||
                  "https://placehold.co/140x200/1f1f1f/ffffff?text=Capa"
                }" alt="${item.title}">
                <span>${item.title}</span>`;
      container.appendChild(card);
    });
  };

  renderCarousel(containers.main, favorites.main);
  for (const mediaType in favorites) {
    if (mediaType !== "main") {
      renderCarousel(containers[mediaType], favorites[mediaType]);
    }
  }
}

function renderStatsByList(lists) {
  const container = document.getElementById("stats-by-list-container");
  container.innerHTML = "";

  const listOrder = [
    "anime",
    "manga",
    "series",
    "movies",
    "comics",
    "books",
    "games",
  ];
  const listIcons = {
    anime: "fa-tv",
    manga: "fa-book-open",
    series: "fa-video",
    movies: "fa-film",
    comics: "fa-book-dead",
    books: "fa-book",
    games: "fa-gamepad",
  };

  listOrder.forEach((mediaType) => {
    const list = lists[mediaType] || [];
    if (list.length === 0) return;

    const card = document.createElement("div");
    card.className = "list-stat-card";

    let statsHtml = "";
    const totalCount = list.length;
    let watchedCount = 0;
    list.forEach((item) => {
      (item.temporadas || []).forEach(
        (s) => (watchedCount += s.watched_episodes || 0)
      );
    });

    const headerKey = `hub.card_${mediaType}`;
    const unitKey = `dashboard.unit_${mediaType}`;

    statsHtml = `
        <h3>
            <i class="fas ${listIcons[mediaType]}"></i> ${t(headerKey)}
            <button class="share-list-btn" data-media-type="${mediaType}" title="Compartilhar Estatísticas de ${t(
      headerKey
    )}">
                <i class="fas fa-share-alt"></i>
            </button>
        </h3>
        <ul>
            <li><span>${t(
              "dashboard.total_in_list"
            )}</span><span>${totalCount}</span></li>
            <li><span>${t(unitKey)}</span><span>${watchedCount}</span></li>
        </ul>`;
    card.innerHTML = statsHtml;
    container.appendChild(card);
  });
}

async function renderSharePreview(mediaType, backgroundUrl) {
  const bgDiv = document.getElementById("share-template-bg");
  const avatarDiv = document.getElementById("share-user-avatar");

  const imageUrl =
    backgroundUrl ||
    currentUserData.coverURL ||
    "https://placehold.co/350x622/1e1e1e/1e1e1e";

  const avatarUrl =
    currentUserData.photoURL ||
    "https://placehold.co/40x40/1f1f1f/ffffff?text=U";

  bgDiv.style.backgroundImage = `url('${imageUrl}')`;
  avatarDiv.style.backgroundImage = `url('${avatarUrl}')`;

  document.getElementById("share-user-nickname").textContent =
    currentUserData.displayName || "Usuário";
  document.getElementById("share-list-title").textContent = t(
    `hub.card_${mediaType}`
  );

  const list = allListsData[mediaType] || [];
  const topItems = list.slice(0, 5);
  const topItemsContainer = document.getElementById("share-top-items");
  topItemsContainer.innerHTML = "";
  topItems.forEach((item, index) => {
    const li = document.createElement("li");
    li.textContent = item.title;
    topItemsContainer.appendChild(li);
  });

  const timeEstimates = { anime: 24, series: 45, movies: 110 };
  let timeSpentMinutes = 0;
  if (timeEstimates[mediaType]) {
    list.forEach((item) => {
      (item.temporadas || []).forEach((season) => {
        timeSpentMinutes +=
          (season.watched_episodes || 0) * timeEstimates[mediaType];
      });
    });
  }
  document.getElementById("share-list-time").textContent = `${Math.floor(
    timeSpentMinutes / 60
  )}h`;
  document.getElementById("share-list-total").textContent = list.length;
  document.getElementById("share-date").textContent =
    new Date().toLocaleDateString();

  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function generateAndDownloadImage() {
  const shareTemplate = document.getElementById("share-template-vertical");
  try {
    const canvas = await html2canvas(shareTemplate, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
    });
    const dataUrl = canvas.toDataURL("image/png");
    window.electronAPI.saveShareImage(dataUrl);
    hideSharePreviewModal();
  } catch (error) {
    console.error("Erro ao gerar a imagem:", error);
  }
}

function showSharePreviewModal(mediaType) {
  const overlay = document.getElementById("share-preview-modal-overlay");
  const bgSelector = document.getElementById("share-bg-selector");

  const list = allListsData[mediaType] || [];
  const favorites = list.filter((item) => item.isFavorite);

  bgSelector.innerHTML = `<option value="${currentUserData.coverURL || ""}">${t(
    "profile.share_profile_cover"
  )}</option>`;
  favorites.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.image_url;
    option.textContent = item.title;
    bgSelector.appendChild(option);
  });
  renderSharePreview(mediaType, bgSelector.value);

  overlay.classList.remove("hidden");
  setTimeout(() => overlay.classList.add("visible"), 10);
}

function hideSharePreviewModal() {
  const overlay = document.getElementById("share-preview-modal-overlay");
  overlay.classList.remove("visible");
  setTimeout(() => overlay.classList.add("hidden"), 200);
}

function showProfileModal(show) {
  const overlay = document.getElementById("edit-profile-modal-overlay");
  if (show) {
    document.getElementById("modal-nickname-input").value =
      currentUserData.displayName || "";
    document.getElementById("modal-avatar-url-input").value =
      currentUserData.photoURL || "";
    document.getElementById("modal-banner-url-input").value =
      currentUserData.coverURL || "";
    overlay.classList.remove("hidden");
    setTimeout(() => overlay.classList.add("visible"), 10);
  } else {
    overlay.classList.remove("visible");
    setTimeout(() => overlay.classList.add("hidden"), 200);
  }
}

async function saveProfileChanges() {
  const newNickname = document
    .getElementById("modal-nickname-input")
    .value.trim();
  const newAvatarUrl = document
    .getElementById("modal-avatar-url-input")
    .value.trim();
  const newBannerUrl = document
    .getElementById("modal-banner-url-input")
    .value.trim();

  if (!newNickname) {
    alert("O nome de exibição não pode ficar em branco.");
    return;
  }

  try {
    await currentUser.updateProfile({
      displayName: newNickname,
      photoURL: newAvatarUrl,
    });

    const userDocRef = db.collection("users").doc(currentUser.uid);
    await userDocRef.update({
      displayName: newNickname,
      photoURL: newAvatarUrl,
      coverURL: newBannerUrl,
    });

    document.getElementById("user-nickname").textContent = newNickname;
    document.getElementById("user-avatar").src =
      newAvatarUrl || "https://placehold.co/120x120/1f1f1f/ffffff?text=A";
    document.getElementById("cover-photo").src =
      newBannerUrl || "https://placehold.co/800x250/1e1e1e/1e1e1e";

    currentUserData.displayName = newNickname;
    currentUserData.photoURL = newAvatarUrl;
    currentUserData.coverURL = newBannerUrl;

    showProfileModal(false);
  } catch (error) {
    console.error("Erro ao salvar o perfil:", error);
    alert("Ocorreu um erro ao salvar as alterações. Tente novamente.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.firebaseInitializationPromise;
  if (!firebaseReady) return;

  auth = window.firebaseAuth;
  db = window.firebaseDb;

  const settings = await window.electronAPI.loadSettings();
  const lang = settings.language || "pt";
  t = await applyTranslations(lang);

  const loadingScreen = document.getElementById("loading-screen");
  const profileContainer = document.querySelector(".profile-container");
  const btnBack = document.getElementById("btn-back");
  const minimizeBtn = document.getElementById("minimize-btn");
  const maximizeBtn = document.getElementById("maximize-btn");
  const closeBtn = document.getElementById("close-btn");
  const editProfileBtn = document.getElementById("edit-profile-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalSaveBtn = document.getElementById("modal-save-btn");
  const statsContainer = document.getElementById("stats-by-list-container");
  const shareBgSelector = document.getElementById("share-bg-selector");
  const shareDownloadBtn = document.getElementById("share-download-btn");
  const shareCancelBtn = document.getElementById("share-cancel-btn");

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;

      loadingScreen.classList.remove("hidden");
      profileContainer.classList.add("hidden");

      const userDocRef = db.collection("users").doc(user.uid);
      const docSnap = await userDocRef.get();
      if (docSnap.exists) {
        currentUserData = docSnap.data();
      }

      currentUserData.displayName = user.displayName;
      currentUserData.photoURL = user.photoURL;

      document.getElementById("user-avatar").src =
        currentUserData.photoURL ||
        "https://placehold.co/120x120/1f1f1f/ffffff?text=A";
      document.getElementById("user-nickname").textContent =
        currentUserData.displayName || "Usuário";
      document.getElementById("cover-photo").src =
        currentUserData.coverURL ||
        "https://placehold.co/800x250/1e1e1e/1e1e1e";

      const allMediaTypes = [
        "anime",
        "manga",
        "movies",
        "series",
        "comics",
        "books",
        "games",
      ];

      for (const type of allMediaTypes) {
        const { mediaList } = await carregarDadosUsuario(db, user.uid, type);
        allListsData[type] = mediaList || [];
      }

      calculateAndRenderOverview(allListsData);
      renderFavoritesCarousel(allListsData);
      renderStatsByList(allListsData);

      loadingScreen.classList.add("hidden");
      profileContainer.classList.remove("hidden");

      window.electronAPI.readyToShow();
    } else {
      window.electronAPI.navigateToMain();
    }
  });

  statsContainer.addEventListener("click", (e) => {
    const shareButton = e.target.closest(".share-list-btn");
    if (shareButton) {
      const mediaType = shareButton.dataset.mediaType;
      shareBgSelector.dataset.mediaType = mediaType;
      showSharePreviewModal(mediaType);
    }
  });

  shareBgSelector.addEventListener("change", (e) => {
    const mediaType = e.target.dataset.mediaType;
    const backgroundUrl = e.target.value;
    renderSharePreview(mediaType, backgroundUrl);
  });

  shareDownloadBtn.addEventListener("click", () => {
    generateAndDownloadImage();
  });
  shareCancelBtn.addEventListener("click", hideSharePreviewModal);

  editProfileBtn.addEventListener("click", () => showProfileModal(true));
  modalCancelBtn.addEventListener("click", () => showProfileModal(false));
  modalSaveBtn.addEventListener("click", saveProfileChanges);
  btnBack.addEventListener("click", () => window.electronAPI.navigateBack());
  minimizeBtn.addEventListener("click", () =>
    window.electronAPI.minimizeWindow()
  );
  maximizeBtn.addEventListener("click", () =>
    window.electronAPI.maximizeWindow()
  );
  closeBtn.addEventListener("click", () => window.electronAPI.closeWindow());
});
