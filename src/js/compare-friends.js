import { applyAppearance } from "./appearance.js";
import { animeService } from "./services/anime-service.js";
import { movieService } from "./services/movie-service.js";
import { seriesService } from "./services/series-service.js";
import { gamesService } from "./services/games-service.js";
import { mangaService } from "./services/manga-service.js";
import { comicsService } from "./services/comics-service.js";
import { booksService } from "./services/books-service.js";

let auth, db, t;
let itemsPerListChartInstance = null;
let genreChartInstance = null;
let cachedUserData = {
  currentUser: null,
  friend: null,
};

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

async function fetchAndEnrichUserData(userId, isCurrentUser = false) {
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return null;

  const userData = userDoc.data();
  // Se não for o usuário atual, apenas retorna os dados como estão.
  if (!isCurrentUser) {
    return userData;
  }

  // Se for o usuário atual, enriquece os dados.
  const lists = userData.lists || {};
  let hasChanges = false;

  const services = {
    anime: animeService,
    movies: movieService,
    series: seriesService,
    games: gamesService,
    manga: mangaService,
    comics: comicsService,
    books: booksService,
  };

  const mediaTypesToUpdate = [
    "anime",
    "movies",
    "series",
    "games",
    "manga",
    "comics",
    "books",
  ];

  for (const mediaType of mediaTypesToUpdate) {
    const list = lists[mediaType] || [];
    for (const item of list) {
      if (
        (!item.genres || item.genres.length === 0) &&
        !item.isCustom &&
        item.mal_id
      ) {
        try {
          console.log(`Buscando gênero para ${item.title} (${mediaType})`);
          const details = await services[mediaType].getDisplayDetails(
            item,
            "en"
          );
          if (details && details.genres && details.genres.length > 0) {
            item.genres = details.genres;
            hasChanges = true;
          }
        } catch (error) {
          console.error(`Falha ao buscar detalhes para ${item.title}:`, error);
        }
      }
    }
  }

  if (hasChanges) {
    console.log(
      `Salvando dados de gênero atualizados para o usuário ${userId}`
    );
    await db
      .collection("users")
      .doc(userId)
      .set({ lists: lists }, { merge: true });
  }

  return userData;
}

function getGenreCounts(userData, mediaType) {
  const genreCount = new Map();
  const list = userData.lists?.[mediaType] || [];

  list.forEach((item) => {
    (item.genres || []).forEach((genre) => {
      const genreName =
        genre && typeof genre === "object"
          ? genre.name
          : typeof genre === "string"
          ? genre
          : null;
      if (genreName) {
        genreCount.set(genreName, (genreCount.get(genreName) || 0) + 1);
      }
    });
  });
  return genreCount;
}

function renderGenreAffinityChart(mediaType) {
  const genrePlaceholder = document.getElementById("genre-placeholder");
  const genreChartCanvas = document.getElementById("genre-affinity-chart");

  const currentUserGenres = getGenreCounts(
    cachedUserData.currentUser,
    mediaType
  );
  const friendUserGenres = getGenreCounts(cachedUserData.friend, mediaType);

  if (currentUserGenres.size === 0 && friendUserGenres.size === 0) {
    if (mediaType === "comics") {
      genrePlaceholder.textContent = t("compare.no_genre_data_comics");
    } else {
      genrePlaceholder.textContent = t("compare.no_genre_data");
    }
    genrePlaceholder.classList.remove("hidden");
    genreChartCanvas.classList.add("hidden");
    if (genreChartInstance) genreChartInstance.destroy();
    genreChartInstance = null;
    return;
  }

  genrePlaceholder.classList.add("hidden");
  genreChartCanvas.classList.remove("hidden");

  const allGenres = new Set([
    ...currentUserGenres.keys(),
    ...friendUserGenres.keys(),
  ]);
  const labels = [...allGenres];

  const currentUserDataPoints = labels.map(
    (genre) => currentUserGenres.get(genre) || 0
  );
  const friendUserDataPoints = labels.map(
    (genre) => friendUserGenres.get(genre) || 0
  );

  const data = {
    labels: labels,
    datasets: [
      {
        label: cachedUserData.currentUser.displayName,
        data: currentUserDataPoints,
        fill: true,
        backgroundColor: "rgba(54, 162, 235, 0.2)",
        borderColor: "rgb(54, 162, 235)",
        pointBackgroundColor: "rgb(54, 162, 235)",
      },
      {
        label: cachedUserData.friend.displayName,
        data: friendUserDataPoints,
        fill: true,
        backgroundColor: "rgba(255, 99, 132, 0.2)",
        borderColor: "rgb(255, 99, 132)",
        pointBackgroundColor: "rgb(255, 99, 132)",
      },
    ],
  };

  if (genreChartInstance) {
    genreChartInstance.destroy();
  }

  genreChartInstance = new Chart(genreChartCanvas.getContext("2d"), {
    type: "radar",
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      elements: { line: { borderWidth: 3 } },
      scales: { r: { suggestedMin: 0 } },
    },
  });
}

function renderPage(currentUserData, friendUserData) {
  document.getElementById("current-user-name").textContent =
    currentUserData.displayName;
  document.getElementById("current-user-summary").querySelector("img").src =
    currentUserData.photoURL || "https://placehold.co/80x80";
  document.getElementById("friend-user-name").textContent =
    friendUserData.displayName;
  document.getElementById("friend-user-summary").querySelector("img").src =
    friendUserData.photoURL || "https://placehold.co/80x80";

  // Gráfico de Itens por Lista
  const listKeys = [
    "anime",
    "manga",
    "movies",
    "series",
    "comics",
    "books",
    "games",
  ];
  const labels = listKeys.map((key) => t(`hub.card_${key}`));

  const currentUserCounts = listKeys.map(
    (key) => currentUserData.lists?.[key]?.length || 0
  );
  const friendUserCounts = listKeys.map(
    (key) => friendUserData.lists?.[key]?.length || 0
  );

  if (itemsPerListChartInstance) {
    itemsPerListChartInstance.destroy();
  }

  itemsPerListChartInstance = new Chart(
    document.getElementById("items-per-list-chart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: currentUserData.displayName,
            data: currentUserCounts,
            backgroundColor: "rgba(54, 162, 235, 0.5)",
            borderColor: "rgba(54, 162, 235, 1)",
            borderWidth: 1,
          },
          {
            label: friendUserData.displayName,
            data: friendUserCounts,
            backgroundColor: "rgba(255, 99, 132, 0.5)",
            borderColor: "rgba(255, 99, 132, 1)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true },
        },
      },
    }
  );

  // Favoritos em Comum
  const commonFavoritesList = document.getElementById("common-favorites-list");
  const currentUserFavorites = Object.values(currentUserData.lists || {})
    .flat()
    .filter((item) => item.isFavorite);
  const friendUserFavorites = Object.values(friendUserData.lists || {})
    .flat()
    .filter((item) => item.isFavorite);
  const commonFavorites = currentUserFavorites.filter((fav1) =>
    friendUserFavorites.some(
      (fav2) => fav2.mal_id === fav1.mal_id && fav1.mal_id
    )
  );

  if (commonFavorites.length > 0) {
    commonFavoritesList.innerHTML = "";
    commonFavorites.forEach((item) => {
      const card = document.createElement("div");
      card.className = "common-item-card";
      card.innerHTML = `
                <img src="${
                  item.image_url || "https://placehold.co/120x170"
                }" alt="${item.title}">
                <span>${item.title}</span>
            `;
      commonFavoritesList.appendChild(card);
    });
  }

  renderGenreAffinityChart("anime"); // Renderiza o gráfico inicial para animes
}

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.electronAPI.getFirebaseConfig();
  if (!firebaseReady) return;

  auth = window.firebaseAuth;
  db = window.firebaseDb;

  const settings = await window.electronAPI.loadSettings();
  const lang = settings.language || "pt";
  t = await applyTranslations(lang);
  applyAppearance(settings);

  const loadingScreen = document.getElementById("loading-screen");
  const compareContainer = document.querySelector(".compare-container");
  const genreSelector = document.getElementById("genre-media-type-selector");

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.electronAPI.navigateToMain();
      return;
    }

    loadingScreen.classList.remove("hidden");

    try {
      const friendId = await window.electronAPI.getUserIdToView();
      // Utiliza a nova função para buscar e enriquecer os dados
      cachedUserData.currentUser = await fetchAndEnrichUserData(user.uid, true); // Salva as mudanças para o usuário atual
      cachedUserData.friend = await fetchAndEnrichUserData(friendId, false); // Não salva para o amigo

      if (cachedUserData.currentUser && cachedUserData.friend) {
        renderPage(cachedUserData.currentUser, cachedUserData.friend);
      }
    } catch (error) {
      console.error("Erro ao carregar dados para comparação:", error);
    } finally {
      loadingScreen.classList.add("hidden");
      compareContainer.classList.remove("hidden");
    }
  });

  genreSelector.addEventListener("change", (e) => {
    renderGenreAffinityChart(e.target.value);
  });

  let resizeTimeout;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (itemsPerListChartInstance) {
        itemsPerListChartInstance.resize();
      }
      if (genreChartInstance) {
        genreChartInstance.resize();
      }
    }, 150);
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
