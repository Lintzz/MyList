import { carregarDadosUsuario } from "./firebase-service.js";

let t;
let auth, db;
let currentUser = null;
let currentUserData = {};

// A biblioteca html2canvas é importada diretamente no profile.html

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
        totalMinutes += watchedEpisodes * timeEstimates[mediaType];
      }
    });
  }

  document.getElementById("total-items").textContent = totalItems;
  document.getElementById("total-completed").textContent = totalCompleted;
  document.getElementById("total-favorites").textContent = totalFavorites;
  const totalHours = Math.floor(totalMinutes / 60);
  document.getElementById("total-time").textContent = `${totalHours}h`;

  document.getElementById("share-total-items").textContent = totalItems;
  document.getElementById("share-total-time").textContent = `${totalHours}h`;
  document.getElementById("share-total-favorites").textContent = totalFavorites;
}

function renderFavoritesCarousel(lists) {
  const carouselContainer = document.getElementById("favorites-carousel");
  const allFavorites = [];

  for (const mediaType in lists) {
    const list = lists[mediaType] || [];
    list.forEach((item) => {
      if (item.isFavorite) {
        allFavorites.push(item);
      }
    });
  }

  if (allFavorites.length === 0) {
    carouselContainer.innerHTML = `<p class="placeholder-text" data-i18n="dashboard.no_favorites">${t(
      "dashboard.no_favorites"
    )}</p>`;
    return;
  }

  carouselContainer.innerHTML = "";
  allFavorites.forEach((item) => {
    const card = document.createElement("div");
    card.className = "favorite-item-card";
    card.innerHTML = `
            <img src="${
              item.image_url ||
              "https://placehold.co/140x200/1f1f1f/ffffff?text=Capa"
            }" alt="${item.title}">
            <span>${item.title}</span>
        `;
    carouselContainer.appendChild(card);
  });
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
      item.temporadas.forEach((s) => (watchedCount += s.watched_episodes || 0));
    });

    const headerKey = `hub.card_${mediaType}`;
    const unitKey = `dashboard.unit_${mediaType}`;

    statsHtml = `
      <h3><i class="fas ${listIcons[mediaType]}"></i> ${t(headerKey)}</h3>
      <ul>
          <li><span>${t(
            "dashboard.total_in_list"
          )}</span><span>${totalCount}</span></li>
          <li><span>${t(unitKey)}</span><span>${watchedCount}</span></li>
      </ul>
    `;
    card.innerHTML = statsHtml;
    container.appendChild(card);
  });
}

async function handleShare() {
  const shareTemplate = document.getElementById("share-template");
  shareTemplate.style.display = "block";

  try {
    const canvas = await html2canvas(shareTemplate);
    const dataUrl = canvas.toDataURL("image/png");
    await window.electronAPI.saveShareImage(dataUrl);
  } catch (error) {
    console.error("Erro ao gerar a imagem:", error);
  } finally {
    shareTemplate.style.display = "none";
  }
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
    // Atualiza no Firebase Auth
    await currentUser.updateProfile({
      displayName: newNickname,
      photoURL: newAvatarUrl,
    });

    // Atualiza no Firestore
    const userDocRef = db.collection("users").doc(currentUser.uid);
    await userDocRef.update({
      displayName: newNickname,
      photoURL: newAvatarUrl,
      coverURL: newBannerUrl,
    });

    // Atualiza a UI localmente
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

  const btnBack = document.getElementById("btn-back");
  const minimizeBtn = document.getElementById("minimize-btn");
  const maximizeBtn = document.getElementById("maximize-btn");
  const closeBtn = document.getElementById("close-btn");
  const shareButton = document.getElementById("share-profile-btn");
  const editProfileBtn = document.getElementById("edit-profile-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalSaveBtn = document.getElementById("modal-save-btn");

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;

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
      const allListsData = {};
      for (const type of allMediaTypes) {
        const { mediaList } = await carregarDadosUsuario(db, user.uid, type);
        allListsData[type] = mediaList;
      }

      calculateAndRenderOverview(allListsData);
      renderFavoritesCarousel(allListsData);
      renderStatsByList(allListsData);

      window.electronAPI.readyToShow();
    } else {
      window.electronAPI.navigateToMain();
    }
  });

  if (shareButton) {
    shareButton.addEventListener("click", handleShare);
  }
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
