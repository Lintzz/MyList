let auth, db, t;

async function applyTranslations(lang) {
  const response = await fetch(`../locales/${lang}.json`);
  const translations = await response.json();
  const translateFn = (key, options = {}) => {
    let text = key.split(".").reduce((obj, i) => obj?.[i], translations) || key;
    for (const option in options) {
      text = text.replace(`{{${option}}}`, options[option]);
    }
    return text;
  };

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key.startsWith("[") && key.includes("]")) {
      const match = key.match(/\[(.*?)\](.*)/);
      if (match) {
        const attr = match[1];
        const actualKey = match[2];
        element.setAttribute(attr, translateFn(actualKey));
      }
    } else {
      element.innerHTML = translateFn(key);
    }
  });

  return translateFn;
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

  const renderCarousel = (container, items, emptyMessageKey) => {
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
            <span>${item.title}</span>
        `;
      container.appendChild(card);
    });
  };

  renderCarousel(
    containers.main,
    favorites.main,
    "dashboard.no_main_favorites"
  );
  for (const mediaType in favorites) {
    if (mediaType !== "main") {
      renderCarousel(
        containers[mediaType],
        favorites[mediaType],
        "dashboard.no_favorites"
      );
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
    if (list.length > 0) {
      const totalCount = list.length;
      let watchedCount = 0;
      list.forEach((item) => {
        if (item.temporadas && Array.isArray(item.temporadas)) {
          item.temporadas.forEach(
            (s) => (watchedCount += s.watched_episodes || 0)
          );
        }
      });

      const headerKey = `hub.card_${mediaType}`;
      const unitKey = `dashboard.unit_${mediaType}`;

      const card = document.createElement("div");
      card.className = "list-stat-card";
      card.innerHTML = `
                <h3><i class="fas ${listIcons[mediaType]}"></i> ${t(
        headerKey
      )}</h3>
                <ul>
                    <li><span>${t(
                      "user_profile.total_in_list"
                    )}</span><span>${totalCount}</span></li>
                    <li><span>${t(
                      unitKey
                    )}</span><span>${watchedCount}</span></li>
                </ul>
            `;
      container.appendChild(card);
    }
  });

  if (container.childElementCount === 0) {
    container.innerHTML = `<p class="placeholder-text">${t(
      "user_profile.no_items"
    )}</p>`;
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
  const coverPhoto = document.getElementById("cover-photo");
  const userAvatar = document.getElementById("user-avatar");
  const userNickname = document.getElementById("user-nickname");

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.electronAPI.navigateToMain();
      return;
    }

    loadingScreen.classList.remove("hidden");

    try {
      const userIdToView = await window.electronAPI.getUserIdToView();
      if (!userIdToView) {
        profileContainer.innerHTML = `<h1>${t(
          "user_profile.user_not_found"
        )}</h1>`;
        return;
      }

      const userDoc = await db.collection("users").doc(userIdToView).get();
      if (!userDoc.exists) {
        profileContainer.innerHTML = `<h1>${t(
          "user_profile.profile_not_found"
        )}</h1>`;
        return;
      }

      const userData = userDoc.data();

      document.title = `${t("user_profile.title")} - ${userData.displayName}`;
      coverPhoto.src =
        userData.coverURL || "https://placehold.co/800x250/1e1e1e/1e1e1e";
      userAvatar.src =
        userData.photoURL ||
        "https://placehold.co/120x120/1f1f1f/ffffff?text=A";
      userNickname.textContent = userData.displayName;

      const userLists = userData.lists || {};
      calculateAndRenderOverview(userLists);
      renderFavoritesCarousel(userLists);
      renderStatsByList(userLists);
    } catch (error) {
      console.error("Erro ao carregar perfil do utilizador:", error);
      profileContainer.innerHTML = `<h1>${t(
        "user_profile.error_loading"
      )}</h1>`;
    } finally {
      loadingScreen.classList.add("hidden");
      profileContainer.classList.remove("hidden");
      window.electronAPI.readyToShow();
    }
  });

  document
    .getElementById("btn-back")
    .addEventListener("click", () => window.electronAPI.navigateBack());
  document
    .getElementById("minimize-btn")
    .addEventListener("click", () => window.electronAPI.minimizeWindow());
  document
    .getElementById("maximize-btn")
    .addEventListener("click", () => window.electronAPI.maximizeWindow());
  document
    .getElementById("close-btn")
    .addEventListener("click", () => window.electronAPI.closeWindow());
});
