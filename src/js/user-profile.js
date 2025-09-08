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

  const timeEstimates = { anime: 24, series: 45, movies: 110 };

  for (const mediaType in lists) {
    const list = lists[mediaType] || [];
    totalItems += list.length;
    list.forEach((item) => {
      if (item.isFavorite) {
        totalFavorites++;
      }
      if (item.temporadas && Array.isArray(item.temporadas)) {
        let isFinished = true;
        let watchedEpisodes = 0;
        item.temporadas.forEach((season) => {
          watchedEpisodes += season.watched_episodes || 0;
          if (
            (season.episodes || 0) > 0 &&
            (season.watched_episodes || 0) < season.episodes
          ) {
            isFinished = false;
          }
        });
        if (isFinished) totalCompleted++;
        if (timeEstimates[mediaType]) {
          totalMinutes += watchedEpisodes * timeEstimates[mediaType];
        }
      }
    });
  }

  document.getElementById("total-items").textContent = totalItems;
  document.getElementById("total-completed").textContent = totalCompleted;
  document.getElementById("total-favorites").textContent = totalFavorites;
  const totalHours = Math.floor(totalMinutes / 60);
  document.getElementById("total-time").textContent = `${totalHours}h`;
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
    carouselContainer.innerHTML = `<p class="placeholder-text">${t(
      "user_profile.no_favorites"
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

      const card = document.createElement("div");
      card.className = "list-stat-card";
      card.innerHTML = `
                <h3><i class="fas ${listIcons[mediaType]}"></i> ${t(
        `hub.card_${mediaType}`
      )}</h3>
                <ul>
                    <li><span>${t(
                      "user_profile.total_in_list"
                    )}</span><span>${totalCount}</span></li>
                    <li><span>${t(
                      "user_profile.units_watched_read"
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
