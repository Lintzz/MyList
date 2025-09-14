import {
  applyTranslations,
  renderResults,
  renderDetailsModalContent,
} from "./views/view-helper.js";
import { applyAppearance } from "./appearance.js";

let t, lang, mediaType;

const searchInput = document.getElementById("explore-search-input");
const searchBtn = document.getElementById("explore-search-btn");
const randomBtn = document.getElementById("random-anime-btn");
const resultsContainer = document.getElementById("explore-results-container");
const detailsModalOverlay = document.getElementById("details-modal-overlay");
const detailsModalCloseBtn = document.getElementById("details-modal-close-btn");
const detailsModalContent = document.getElementById("details-modal-content");
const contentContainer = document.querySelector(".content-container");

function setControlsDisabled(disabled) {
  searchInput.disabled = disabled;
  searchBtn.disabled = disabled;
  randomBtn.disabled = disabled;
}

function showLoading() {
  contentContainer.classList.add("loading");
  setControlsDisabled(true);
}

function hideLoading() {
  contentContainer.classList.remove("loading");
  setControlsDisabled(false);
}

window.addEventListener("message", async (event) => {
  const { type, payload } = event.data;

  if (type === "init") {
    mediaType = payload.mediaType;
    lang = payload.settings.language || "pt";
    t = await applyTranslations(lang);
    applyAppearance(payload.settings);

    const placeholderKey = `app.explore_placeholder_${mediaType}`;
    const randomBtnKey = `app.explore_random_button_${mediaType}`;
    searchInput.placeholder = t(placeholderKey, "Pesquisar...");
    randomBtn.textContent = t(randomBtnKey, "Aleatório");
    return;
  }

  if (type === "search-data" || type === "random-data") {
    hideLoading();
    if (payload.error && payload.error !== "OK") {
      handleApiError(payload.message);
      return;
    }

    let results =
      payload.data ||
      payload.results ||
      payload.items ||
      payload.works ||
      payload.docs;

    if (!Array.isArray(results)) {
      results = [results];
    }

    // if (
    //   type === "random-data" &&
    //   results.length > 0 &&
    //   (mediaType === "movies" ||
    //     mediaType === "series" ||
    //     mediaType === "books")
    // ) {
    //   results = [results[Math.floor(Math.random() * results.length)]];
    // }

    renderResults(results, resultsContainer, t, mediaType);
  }

  if (type === "details-data") {
    if (payload.error && payload.error !== "OK") {
      detailsModalContent.innerHTML = `<p>${t(
        "app.load_error",
        "Erro ao carregar."
      )}</p>`;
      return;
    }
    await renderDetailsModalContent(
      payload,
      lang,
      t,
      payload.results?.parts ? "collection" : mediaType,
      detailsModalContent
    );
  }
});

function handleSearch() {
  const term = searchInput.value.trim();
  if (term.length < 3) return;

  showLoading();
  resultsContainer.innerHTML = "";

  window.parent.postMessage(
    { type: "fetch-search", payload: { mediaType, term } },
    "*"
  );
}

function handleRandom() {
  showLoading();
  resultsContainer.innerHTML = "";

  window.parent.postMessage(
    { type: "fetch-random", payload: { mediaType } },
    "*"
  );
}

function handleApiError(message) {
  hideLoading();

  resultsContainer.innerHTML = `<p class="placeholder-text">${t(
    "app.add_modal_search_error",
    "Erro ao buscar."
  )}</p>`;
}

function openDetailsModal(id, type) {
  detailsModalOverlay.classList.remove("hidden");
  setTimeout(() => detailsModalOverlay.classList.add("visible"), 10);
  detailsModalContent.innerHTML = `<div class="spinner" style="margin: 20px auto;"></div><p>${t(
    "app.details_modal_loading",
    "A carregar..."
  )}</p>`;
  window.parent.postMessage(
    { type: "fetch-details", payload: { mediaType: type, id } },
    "*"
  );
}

function closeDetailsModal() {
  detailsModalOverlay.classList.remove("visible");
  setTimeout(() => detailsModalOverlay.classList.add("hidden"), 200);
}

searchBtn.addEventListener("click", handleSearch);
randomBtn.addEventListener("click", handleRandom);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleSearch();
});
detailsModalCloseBtn.addEventListener("click", closeDetailsModal);
detailsModalOverlay.addEventListener("click", (e) => {
  if (e.target === detailsModalOverlay) closeDetailsModal();
});

resultsContainer.addEventListener("click", (event) => {
  const addButton = event.target.closest(".anime-card-add-btn");
  const detailsLink = event.target.closest(".anime-card-image-link");

  if (addButton) {
    const { id, title, type, authors } = addButton.dataset;

    if (type === "books" || type === "games") {
      window.parent.postMessage(
        {
          type: "add-item-direct",
          malId: id,
          title,
          itemType: type,
          authors: authors ? JSON.parse(authors) : [],
        },
        "*"
      );
    } else {
      window.parent.postMessage(
        {
          type: "open-add-anime-flow",
          malId: id,
          title,
          itemType: type,
          authors: authors ? JSON.parse(authors) : [],
        },
        "*"
      );
    }
  } else if (detailsLink) {
    const { id, type } = detailsLink.dataset;
    openDetailsModal(id, type);
  }
});
