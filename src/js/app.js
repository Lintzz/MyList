import { carregarDadosUsuario, salvarLista } from "./firebase-service.js";
import {
  renderizarLista,
  atualizarPerfilUsuario,
  atualizarUIEpisodio,
  renderizarSelecaoTemporadas,
  renderizarListaEdicao,
  renderizarDetalhesAnime,
  getItemStatus,
} from "./ui.js";
import { showConfirmationModal, showErrorModal } from "./modal.js";
import { animeService } from "./services/anime-service.js";
import { movieService } from "./services/movie-service.js";
import { mangaService } from "./services/manga-service.js";
import { seriesService } from "./services/series-service.js";
import { booksService } from "./services/books-service.js";
import { comicsService } from "./services/comics-service.js";
import { gamesService } from "./services/games-service.js";

let auth, db;

window.mudarAba = mudarAba;

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

async function mudarAba(content) {
  const topNav = document.querySelector(".top-nav");
  const navLinks = document.querySelectorAll(".top-nav .nav-link");
  const listaView = document.getElementById("lista-view");
  const contentFrame = document.getElementById("content-frame");

  const targetLink = topNav.querySelector(
    `.nav-link[data-content="${content}"]`
  );
  if (!targetLink) return;

  navLinks.forEach((link) => link.classList.remove("active"));
  targetLink.classList.add("active");

  if (content === "lista") {
    listaView.classList.remove("hidden");
    contentFrame.classList.add("hidden");
    contentFrame.src = "about:blank";
  } else {
    listaView.classList.add("hidden");
    contentFrame.classList.remove("hidden");

    let page;
    switch (content) {
      case "explorar":
        page = "explorar.html";
        break;
      case "tendencias":
        page = "tendencias.html";
        break;
      default:
        return;
    }
    contentFrame.src = page;

    contentFrame.onload = async () => {
      const currentSettings = await window.electronAPI.loadSettings();
      const currentMediaType = await window.electronAPI.getListType();
      contentFrame.contentWindow.postMessage(
        {
          type: "init",
          payload: {
            mediaType: currentMediaType,
            settings: currentSettings,
          },
        },
        "*"
      );
    };
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.firebaseInitializationPromise;
  if (!firebaseReady) return;

  try {
    auth = window.firebaseAuth;
    db = window.firebaseDb;
    const contentFrame = document.getElementById("content-frame");

    let currentUser = null;
    let listaCompleta = [];
    let proximoId = 0;
    let itemParaAdicionar = null;
    let ultimosResultadosBusca = [];
    let itemEmEdicao = null;
    let sortable = null;
    let mainListSortable = null;
    let debounceTimer;
    let activeFilter = "todos";
    let activeSort = "added";
    let currentMediaType = null;
    let apiService = null;
    let currentSettings = {};
    let itemParaAdicionarDireto = null;

    currentMediaType = await window.electronAPI.getListType();

    const serviceMap = {
      anime: animeService,
      movies: movieService,
      manga: mangaService,
      series: seriesService,
      books: booksService,
      comics: comicsService,
      games: gamesService,
    };
    apiService = serviceMap[currentMediaType];

    if (!apiService) {
      document.body.innerHTML = `<p>Erro: Tipo de lista (${currentMediaType}) não suportado.</p>`;
      return;
    }

    currentSettings = await window.electronAPI.loadSettings();
    activeSort = currentSettings.sortPreference || "added";
    const lang = currentSettings.language || "pt";
    const t = await applyTranslations(lang);

    const loadingScreen = document.getElementById("loading-screen");
    const appContent = document.getElementById("app-content");
    const minhaListaContainer = document.getElementById("minhaLista");
    const mostrarFormBtn = document.getElementById("mostrarFormBtn");
    const pesquisaInput = document.getElementById("pesquisaInput");
    const userProfileArea = document.getElementById("user-profile-area");
    const userProfileDropdown = document.getElementById(
      "user-profile-dropdown"
    );
    const btnMyProfile = document.getElementById("btn-my-profile");
    const btnMyFriends = document.getElementById("btn-my-friends");
    const btnSettings = document.getElementById("btn-settings");
    const btnLogout = document.getElementById("btn-logout");
    const btnBackToHub = document.getElementById("btn-back-hub");
    const minimizeBtn = document.getElementById("minimize-btn");
    const maximizeBtn = document.getElementById("maximize-btn");
    const closeBtn = document.getElementById("close-btn");
    const randomItemBtn = document.getElementById("random-item-btn");
    const filterMenuBtn = document.getElementById("filter-menu-btn");
    const filterDropdown = document.getElementById("filter-dropdown");
    const sortMenuBtn = document.getElementById("sort-menu-btn");
    const sortDropdown = document.getElementById("sort-dropdown");
    const searchModalOverlay = document.getElementById("search-modal-overlay");
    const searchModalTitle = searchModalOverlay.querySelector("h2");
    const searchModalInput = document.getElementById("search-modal-input");
    const searchModalBtn = document.getElementById("search-modal-btn");
    const searchModalResults = document.getElementById("search-modal-results");
    const searchModalCloseBtn = document.getElementById(
      "search-modal-close-btn"
    );
    const searchView = document.getElementById("search-view");
    const seasonSelectionView = document.getElementById(
      "season-selection-view"
    );
    const seasonSelectionTitle = seasonSelectionView.querySelector("h2");
    const selectedAnimeTitle = document.getElementById("selected-anime-title");
    const seasonSelectionSubtitlePrefix = document.getElementById(
      "season-selection-subtitle-prefix"
    );
    const seasonSelectionSubtitleSuffix = document.getElementById(
      "season-selection-subtitle-suffix"
    );
    const seasonSelectionList = document.getElementById(
      "season-selection-list"
    );
    const addSelectedSeasonsBtn = document.getElementById(
      "add-selected-seasons-btn"
    );
    const editModalOverlay = document.getElementById("edit-modal-overlay");
    const editModalLoadingOverlay =
      editModalOverlay.querySelector(".loading-overlay");
    const editModalTitle = editModalOverlay.querySelector(
      "h2 > span:first-child"
    );
    const editAnimeTitle = document.getElementById("edit-anime-title");
    const editSeasonList = document.getElementById("edit-season-list");
    const checkNewSeasonsBtn = document.getElementById("check-new-seasons-btn");
    const editModalCancelBtn = document.getElementById("edit-modal-cancel-btn");
    const editModalSaveBtn = document.getElementById("edit-modal-save-btn");
    const detailsModalOverlay = document.getElementById(
      "details-modal-overlay"
    );
    const detailsModalCloseBtn = document.getElementById(
      "details-modal-close-btn"
    );
    const optionsDropdown = document.getElementById("options-dropdown");
    const btnDropdownFavorite = document.getElementById(
      "btn-dropdown-favorite"
    );
    const btnDropdownEdit = document.getElementById("btn-dropdown-edit");
    const btnDropdownDelete = document.getElementById("btn-dropdown-delete");
    const topNav = document.querySelector(".top-nav");
    const listTitleBtn = document.getElementById("list-title-btn");
    const listSwitcherDropdown = document.getElementById(
      "list-switcher-dropdown"
    );
    const pageTitleText = document.getElementById("page-title-text");
    const markAllWatchedBtn = document.getElementById("mark-all-watched-btn");
    const markAllWatchedEditBtn = document.getElementById(
      "mark-all-watched-edit-btn"
    );
    const updateNotification = document.getElementById("update-notification");
    const updateNowBtn = document.getElementById("update-now-btn");
    const toastNotification = document.getElementById("toast-notification");

    const modalOverlay = document.getElementById("modal-overlay");
    const modalBtnConfirm = document.getElementById("modal-btn-confirm");

    const statusModalOverlay = document.getElementById("status-modal-overlay");
    const statusModalMessage = document.getElementById("status-modal-message");
    const statusModalOptions = document.getElementById("status-modal-options");
    const statusModalCancelBtn = document.getElementById(
      "status-modal-cancel-btn"
    );

    const titleKey = `app.title_${currentMediaType}`;
    const pageTitle = t(titleKey);
    document.title = pageTitle;
    pageTitleText.textContent = pageTitle;

    mostrarFormBtn.setAttribute("title", t("app.add_item_tooltip"));
    randomItemBtn.setAttribute("title", t("app.random_tooltip"));
    searchModalTitle.textContent = t("app.add_modal_title");
    searchModalInput.setAttribute(
      "placeholder",
      t("app.add_modal_placeholder")
    );
    seasonSelectionTitle.textContent = t("app.add_modal_seasons_title");
    addSelectedSeasonsBtn.textContent = t("app.add_modal_add_button");
    editModalTitle.textContent = t("app.edit_modal_title");

    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        mostrarConteudoPrincipal();
        iniciarCarregamentoDeDados();
      } else {
        window.electronAPI.navigateToMain();
      }
    });

    function showToast(message) {
      toastNotification.textContent = message;
      toastNotification.classList.remove("hidden");
      toastNotification.classList.add("visible");
      setTimeout(() => {
        toastNotification.classList.remove("visible");
        setTimeout(() => toastNotification.classList.add("hidden"), 300);
      }, 3000);
    }

    window.addEventListener("message", async (event) => {
      const { type, payload, malId, title, itemType, authors } = event.data;
      if (!type) return;
      try {
        let result;
        switch (type) {
          case "fetch-trending":
            result = await window.electronAPI.getTrendingMedia(
              payload.mediaType
            );
            contentFrame.contentWindow.postMessage(
              { type: "trending-data", payload: result },
              "*"
            );
            break;
          case "fetch-random":
            result = await window.electronAPI.getRandomMedia(payload.mediaType);
            contentFrame.contentWindow.postMessage(
              { type: "random-data", payload: result },
              "*"
            );
            break;
          case "fetch-search":
            result = await window.electronAPI.searchMedia(
              payload.mediaType,
              payload.term
            );
            contentFrame.contentWindow.postMessage(
              { type: "search-data", payload: result },
              "*"
            );
            break;
          case "fetch-details":
            result = await window.electronAPI.getMediaDetails(
              payload.mediaType,
              payload.id
            );
            contentFrame.contentWindow.postMessage(
              { type: "details-data", payload: result },
              "*"
            );
            break;
          case "open-add-anime-flow":
            abrirModalBusca();
            exibirTelaSelecaoTemporadas(malId, title, itemType);
            break;
          case "add-item-direct":
            abrirModalStatus(malId, title, itemType);
            break;
        }
      } catch (error) {
        console.error(
          `Erro ao processar mensagem do iframe (tipo: ${type}):`,
          error
        );
        contentFrame.contentWindow.postMessage(
          { type: `${type}-error`, payload: { message: error.message } },
          "*"
        );
      }
    });

    topNav.addEventListener("click", (e) => {
      e.preventDefault();
      const targetLink = e.target.closest(".nav-link");
      if (!targetLink) return;
      mudarAba(targetLink.dataset.content);
    });

    function mostrarConteudoPrincipal() {
      loadingScreen.style.display = "none";
      appContent.classList.remove("hidden");
      window.electronAPI.readyToShow();
    }

    async function iniciarCarregamentoDeDados() {
      const { userData, mediaList } = await carregarDadosUsuario(
        db,
        currentUser.uid,
        currentMediaType
      );
      if (userData) {
        atualizarPerfilUsuario(userData);
      }
      listaCompleta = mediaList || [];
      proximoId =
        listaCompleta.length > 0
          ? Math.max(...listaCompleta.map((a) => a.id || 0)) + 1
          : 1;
      filtrarESortearERenderizarLista();
    }

    function filtrarESortearERenderizarLista() {
      const termoPesquisa = pesquisaInput.value.toLowerCase();
      let listaProcessada = [...listaCompleta];

      if (termoPesquisa) {
        listaProcessada = listaProcessada.filter((item) =>
          item.title.toLowerCase().includes(termoPesquisa)
        );
      }

      if (activeFilter !== "todos") {
        if (activeFilter === "favoritos") {
          listaProcessada = listaProcessada.filter((item) => item.isFavorite);
        } else {
          listaProcessada = listaProcessada.filter(
            (item) => getItemStatus(item, currentMediaType) === activeFilter
          );
        }
      }

      const statusOrder = {
        "nao-comecou": 0,
        assistindo: 1,
        concluido: 2,
        finished: 3,
      };

      if (activeSort !== "personal") {
        switch (activeSort) {
          case "added":
            listaProcessada.sort((a, b) => b.id - a.id);
            break;
          case "alpha-asc":
            listaProcessada.sort((a, b) => a.title.localeCompare(b.title));
            break;
          case "alpha-desc":
            listaProcessada.sort((a, b) => b.title.localeCompare(a.title));
            break;
          case "status":
            listaProcessada.sort((a, b) => {
              const statusA = statusOrder[getItemStatus(a, currentMediaType)];
              const statusB = statusOrder[getItemStatus(b, currentMediaType)];
              if (statusA === statusB) {
                return a.title.localeCompare(b.title);
              }
              return statusA - statusB;
            });
            break;
        }
      }

      const filterKey = `app.filter_${activeFilter.replace("-", "_")}`;
      filterMenuBtn.textContent = `Filtro: ${t(filterKey)} (${
        listaProcessada.length
      })`;

      const sortKey = `app.sort_${activeSort.replace("-", "_")}`;
      sortMenuBtn.textContent = `Ordenar: ${t(sortKey)}`;

      renderizarLista(
        listaProcessada,
        minhaListaContainer,
        t,
        currentMediaType,
        activeSort
      );
      inicializarDragAndDrop();
    }

    function hideModal() {
      const modal = document.getElementById("modal-overlay");
      if (modal) {
        modal.classList.remove("visible");
        setTimeout(() => modal.classList.add("hidden"), 200);
      }
    }

    function abrirModalBusca() {
      searchView.classList.remove("hidden");
      seasonSelectionView.classList.add("hidden");
      searchModalInput.value = "";
      searchModalResults.innerHTML = `<p style="text-align: center; padding: 20px;">${t(
        "app.add_modal_initial_text"
      )}</p>`;
      searchModalOverlay.classList.remove("hidden");
      setTimeout(() => searchModalOverlay.classList.add("visible"), 10);
    }

    function fecharModalBusca() {
      searchModalOverlay.classList.remove("visible");
      setTimeout(() => {
        searchModalOverlay.classList.add("hidden");
        if (sortable) {
          sortable.destroy();
          sortable = null;
        }
      }, 200);
    }

    async function buscarItem() {
      const termo = searchModalInput.value.trim();
      if (termo.length < 3) return;
      searchModalResults.innerHTML =
        '<div class="spinner" style="margin: 20px auto;"></div>';
      try {
        ultimosResultadosBusca = await apiService.search(termo);
        renderizarResultadosBusca(
          ultimosResultadosBusca,
          searchModalResults,
          t
        );
      } catch (error) {
        console.error("Erro ao buscar:", error);
        showErrorModal("Erro de Busca", t("app.add_modal_search_error"));
        searchModalResults.innerHTML = `<p>${t(
          "app.add_modal_search_error"
        )}</p>`;
      }
    }

    async function exibirTelaSelecaoTemporadas(itemId, itemTitle, itemType) {
      searchView.classList.add("hidden");
      seasonSelectionView.classList.remove("hidden");

      const subtitle = t("app.add_modal_seasons_subtitle");
      const parts = subtitle.split("<strong>{{title}}</strong>");
      seasonSelectionSubtitlePrefix.textContent = parts[0] || "";
      selectedAnimeTitle.textContent = itemTitle;
      seasonSelectionSubtitleSuffix.textContent = parts[1] || "";
      seasonSelectionList.innerHTML =
        '<div class="spinner" style="margin: 20px auto;"></div>';

      try {
        const itemCompleto = await apiService.getDetails(
          itemId,
          null,
          itemType
        );
        if (!itemCompleto) {
          showErrorModal("Erro", t("app.add_modal_no_details_error"));
          return;
        }
        itemParaAdicionar = itemCompleto;
        renderizarSelecaoTemporadas(
          itemCompleto.temporadas,
          seasonSelectionList,
          currentMediaType,
          t
        );
        const sortableList = seasonSelectionList.querySelector(
          ".season-list-sortable"
        );
        if (sortable) sortable.destroy();
        sortable = new Sortable(sortableList, {
          animation: 150,
          handle: ".drag-handle",
        });
      } catch (error) {
        console.error("Erro ao buscar detalhes completos:", error);
        showErrorModal("Erro", t("app.add_modal_load_details_error"));
      }
    }

    async function adicionarItemDireto(status) {
      const itemCompleto = itemParaAdicionarDireto;
      if (!itemCompleto) {
        showErrorModal("Erro", "Não foi possível obter os detalhes do item.");
        return;
      }

      const itemJaExiste = listaCompleta.some(
        (item) => String(item.mal_id) === String(itemCompleto.id)
      );
      if (itemJaExiste) {
        showErrorModal(
          "Item Repetido",
          `O item "${itemCompleto.title}" já está na sua lista.`
        );
        return;
      }

      let watchedEpisodes = 0;
      if (status === "concluido" || status === "finished") {
        watchedEpisodes = 1;
      }

      const imageUrl = itemCompleto.image_url || "";
      const novoItem = {
        id: proximoId++,
        mal_id: itemCompleto.id,
        title: itemCompleto.title,
        authors: itemCompleto.authors || [],
        publisherName: itemCompleto.publisherName || null,
        itemType: currentMediaType,
        image_url: imageUrl,
        synopsis: itemCompleto.synopsis || "",
        temporadas: [
          {
            title: itemCompleto.title,
            episodes: 1,
            watched_episodes: watchedEpisodes,
          },
        ],
        isFavorite: false,
        userStatus: status,
      };

      listaCompleta.unshift(novoItem);
      const success = await salvarLista(
        db,
        currentUser.uid,
        listaCompleta,
        currentMediaType
      );

      if (success) {
        filtrarESortearERenderizarLista();
        showToast(`"${novoItem.title}" foi adicionado à sua lista!`);
      } else {
        listaCompleta.shift();
        proximoId--;
      }
      itemParaAdicionarDireto = null;
    }

    async function abrirModalStatus(itemId, title, itemType) {
      itemParaAdicionarDireto = await apiService.getDetails(
        itemId,
        null,
        itemType
      );
      if (!itemParaAdicionarDireto) {
        showErrorModal(
          "Erro",
          "Não foi possível carregar os detalhes do item."
        );
        return;
      }

      statusModalMessage.querySelector("strong").textContent = title;

      const statusButtons =
        statusModalOptions.querySelectorAll(".status-option-btn");
      const mediaTypeSuffix = currentMediaType === "books" ? "books" : "games";

      statusButtons[0].textContent = t(
        `app.status_not_started_${mediaTypeSuffix}`
      );
      statusButtons[0].dataset.status = "nao-comecou";
      statusButtons[1].textContent = t(
        `app.status_in_progress_${mediaTypeSuffix}`
      );
      statusButtons[1].dataset.status = "assistindo";
      statusButtons[2].textContent = t(
        `app.status_completed_${mediaTypeSuffix}`
      );
      statusButtons[2].dataset.status = "finished";

      statusModalOverlay.classList.remove("hidden");
      setTimeout(() => statusModalOverlay.classList.add("visible"), 10);
    }

    function fecharModalStatus() {
      statusModalOverlay.classList.remove("visible");
      setTimeout(() => statusModalOverlay.classList.add("hidden"), 200);
    }

    async function adicionarItemSelecionado() {
      if (!itemParaAdicionar) {
        showErrorModal("Erro", t("app.add_modal_no_item_selected_error"));
        return;
      }

      const itemJaExiste = listaCompleta.some(
        (item) =>
          String(item.mal_id) ===
          String(itemParaAdicionar.mal_id || itemParaAdicionar.id)
      );

      if (itemJaExiste) {
        showErrorModal(
          "Item Repetido",
          `O item "${itemParaAdicionar.title}" já está na sua lista.`
        );
        addSelectedSeasonsBtn.disabled = false;
        addSelectedSeasonsBtn.innerHTML = t("app.add_modal_add_button");
        return;
      }

      addSelectedSeasonsBtn.disabled = true;
      addSelectedSeasonsBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Adicionando...';

      const seasonItems = seasonSelectionList.querySelectorAll(
        ".season-selection-item"
      );
      const temporadasSelecionadas = [];

      seasonItems.forEach((item) => {
        const originalIndex = parseInt(item.dataset.originalIndex, 10);
        const watchedInput = item.querySelector(".episode-input-add");
        const temporadaData = itemParaAdicionar.temporadas[originalIndex];
        if (temporadaData) {
          temporadasSelecionadas.push({
            title: temporadaData.title,
            episodes: temporadaData.episodes,
            watched_episodes: parseInt(watchedInput.value, 10) || 0,
          });
        }
      });
      if (temporadasSelecionadas.length === 0) {
        showErrorModal("Erro", t("app.add_modal_empty_seasons_error"));
        addSelectedSeasonsBtn.disabled = false;
        addSelectedSeasonsBtn.innerHTML = t("app.add_modal_add_button");
        return;
      }

      const imageUrl =
        itemParaAdicionar.image_url ||
        itemParaAdicionar.images?.jpg?.large_image_url ||
        "";

      const novoItem = {
        id: proximoId++,
        mal_id: itemParaAdicionar.mal_id || itemParaAdicionar.id,
        title: itemParaAdicionar.title,
        authors: itemParaAdicionar.authors || [],
        publisherName: itemParaAdicionar.publisherName || null,
        itemType: itemParaAdicionar.itemType || null,
        image_url: imageUrl,
        synopsis:
          itemParaAdicionar.synopsis || itemParaAdicionar.overview || "",
        temporadas: temporadasSelecionadas,
        isFavorite: false,
      };

      listaCompleta.unshift(novoItem);
      const success = await salvarLista(
        db,
        currentUser.uid,
        listaCompleta,
        currentMediaType
      );
      if (success) {
        filtrarESortearERenderizarLista();
        fecharModalBusca();
        showToast(`"${novoItem.title}" foi adicionado à sua lista!`);
      } else {
        listaCompleta.shift();
        proximoId--;
      }

      addSelectedSeasonsBtn.disabled = false;
      addSelectedSeasonsBtn.innerHTML = t("app.add_modal_add_button");
    }

    async function abrirModalDetalhes(itemId) {
      const itemLocal = listaCompleta.find((a) => a.id === itemId);
      if (!itemLocal) return;

      detailsModalOverlay.classList.remove("hidden");
      setTimeout(() => detailsModalOverlay.classList.add("visible"), 10);
      renderizarDetalhesAnime(null, t, currentMediaType);

      try {
        const itemCompleto = await apiService.getDisplayDetails(
          itemLocal,
          lang
        );
        itemLocal.mal_id = itemCompleto.mal_id || itemLocal.mal_id;
        itemLocal.image_url =
          itemCompleto.images?.jpg?.large_image_url || itemLocal.image_url;

        await salvarLista(db, currentUser.uid, listaCompleta, currentMediaType);
        renderizarDetalhesAnime(itemCompleto, t, currentMediaType);
      } catch (error) {
        console.error("Erro ao buscar detalhes:", error);
        renderizarDetalhesAnime(
          { title: itemLocal.title, synopsis: t("app.load_error") },
          t,
          currentMediaType
        );
      }
    }

    function fecharModalDetalhes() {
      detailsModalOverlay.classList.remove("visible");
      setTimeout(() => detailsModalOverlay.classList.add("hidden"), 200);
    }

    function abrirModalEdicao(itemId) {
      itemEmEdicao = listaCompleta.find((a) => a.id === itemId);
      if (!itemEmEdicao) return;
      editAnimeTitle.textContent = itemEmEdicao.title;

      if (
        currentMediaType === "books" ||
        (currentMediaType === "movies" && itemEmEdicao.itemType === "movie") ||
        currentMediaType === "games"
      ) {
        checkNewSeasonsBtn.style.display = "none";
      } else {
        checkNewSeasonsBtn.style.display = "inline-block";
      }

      sortable = renderizarListaEdicao(
        itemEmEdicao,
        editSeasonList,
        sortable,
        currentMediaType,
        t
      );
      editModalOverlay.classList.remove("hidden");
      setTimeout(() => editModalOverlay.classList.add("visible"), 10);
    }

    function fecharModalEdicao() {
      editModalOverlay.classList.remove("visible");
      setTimeout(() => {
        editModalOverlay.classList.add("hidden");
        itemEmEdicao = null;
        if (sortable) {
          sortable.destroy();
          sortable = null;
        }
      }, 200);
    }

    async function salvarEdicao() {
      const originalTemporadas = JSON.parse(
        JSON.stringify(itemEmEdicao.temporadas)
      );
      editModalSaveBtn.disabled = true;
      editModalSaveBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Salvando...';

      const seasonItems = editSeasonList.querySelectorAll(".edit-season-item");
      const novasTemporadas = [];
      const titulosNaNovaOrdem = Array.from(seasonItems).map(
        (item) => item.dataset.originalTitle
      );

      titulosNaNovaOrdem.forEach((title) => {
        const temporadaOriginal = originalTemporadas.find(
          (t) => t.title === title
        );
        const itemDOM = Array.from(seasonItems).find(
          (item) => item.dataset.originalTitle === title
        );
        if (temporadaOriginal && itemDOM) {
          temporadaOriginal.watched_episodes = parseInt(
            itemDOM.querySelector(".episode-input").value,
            10
          );
          novasTemporadas.push(temporadaOriginal);
        }
      });
      itemEmEdicao.temporadas = novasTemporadas;

      const success = await salvarLista(
        db,
        currentUser.uid,
        listaCompleta,
        currentMediaType
      );
      if (success) {
        filtrarESortearERenderizarLista();
        fecharModalEdicao();
      } else {
        itemEmEdicao.temporadas = originalTemporadas;
      }
      editModalSaveBtn.disabled = false;
      editModalSaveBtn.innerHTML = t("app.edit_modal_save_button");
    }

    async function verificarNovasTemporadas() {
      if (!itemEmEdicao) return;

      editModalLoadingOverlay.classList.remove("hidden");
      checkNewSeasonsBtn.disabled = true;
      checkNewSeasonsBtn.textContent = t("app.edit_modal_checking_seasons");

      try {
        let itemTypeParaVerificar = itemEmEdicao.itemType || currentMediaType;

        const itemCompleto = await apiService.getDetails(
          itemEmEdicao.mal_id,
          null,
          itemTypeParaVerificar
        );

        if (!itemCompleto) {
          throw new Error("Não foi possível obter detalhes da API.");
        }

        if (currentMediaType === "manga") {
          const capitulosAPI = itemCompleto.temporadas[0]?.episodes || 0;
          const capitulosAtuais = itemEmEdicao.temporadas[0]?.episodes || 0;

          if (capitulosAPI > capitulosAtuais) {
            itemEmEdicao.temporadas[0].episodes = capitulosAPI;
            sortable = renderizarListaEdicao(
              itemEmEdicao,
              editSeasonList,
              sortable,
              currentMediaType,
              t
            );
            showConfirmationModal(
              "Atualizado!",
              `O número de capítulos de ${itemEmEdicao.title} foi atualizado para ${capitulosAPI}.`,
              () => {},
              true
            );
          } else {
            showConfirmationModal(
              "Nenhuma Novidade",
              "O número de capítulos continua o mesmo.",
              () => {},
              true
            );
          }
        } else {
          const titulosAtuais = new Set(
            itemEmEdicao.temporadas.map((t) => t.title)
          );
          const novasPartes = itemCompleto.temporadas.filter(
            (t) => !titulosAtuais.has(t.title)
          );

          if (novasPartes.length > 0) {
            novasPartes.forEach((nova) => {
              itemEmEdicao.temporadas.push({ ...nova, watched_episodes: 0 });
            });
            sortable = renderizarListaEdicao(
              itemEmEdicao,
              editSeasonList,
              sortable,
              currentMediaType,
              t
            );
            showConfirmationModal(
              "Novidades Encontradas!",
              `${novasPartes.length} nova(s) parte(s) foram adicionadas à lista de edição.`,
              () => {},
              true
            );
          } else {
            showConfirmationModal(
              "Nenhuma Novidade",
              "Não foram encontradas novas partes para este item.",
              () => {},
              true
            );
          }
        }
      } catch (error) {
        console.error("Erro ao verificar novas partes:", error);
        showErrorModal("Erro", t("app.edit_modal_check_error"));
      } finally {
        editModalLoadingOverlay.classList.add("hidden");
        checkNewSeasonsBtn.disabled = false;
        checkNewSeasonsBtn.textContent = t(
          "app.edit_modal_check_seasons_button"
        );
      }
    }

    async function apagarItem(itemId) {
      const itemIndex = listaCompleta.findIndex((a) => a.id === itemId);
      if (itemIndex === -1) return;

      const itemElement = document.querySelector(
        `.anime-entry[data-id="${itemId}"]`
      );
      if (itemElement) {
        itemElement.classList.add("deleting");
      }

      const [removedItem] = listaCompleta.splice(itemIndex, 1);
      const success = await salvarLista(
        db,
        currentUser.uid,
        listaCompleta,
        currentMediaType
      );

      if (success) {
        filtrarESortearERenderizarLista();
      } else {
        listaCompleta.splice(itemIndex, 0, removedItem);
        if (itemElement) {
          itemElement.classList.remove("deleting");
        }
      }
    }

    function atualizarEpisodio(itemId, seasonIndex, novoValor) {
      const item = listaCompleta.find((a) => a.id === itemId);
      if (!item || !item.temporadas[seasonIndex]) return;
      const temporada = item.temporadas[seasonIndex];
      const oldValue = temporada.watched_episodes;

      const valorNumerico = isNaN(novoValor) ? 0 : novoValor;

      const total = isNaN(parseInt(temporada.episodes))
        ? Infinity
        : parseInt(temporada.episodes);

      let valorValidado = Math.max(0, valorNumerico);
      if (total !== Infinity) {
        valorValidado = Math.min(valorValidado, total);
      }

      temporada.watched_episodes = valorValidado;

      let totalEpisodiosGeral = 0;
      let episodiosAssistidosTotal = 0;
      item.temporadas.forEach((temp) => {
        totalEpisodiosGeral += temp.episodes || 0;
        episodiosAssistidosTotal += temp.watched_episodes || 0;
      });
      const newStatus = getItemStatus(item, currentMediaType);

      atualizarUIEpisodio(
        itemId,
        seasonIndex,
        valorValidado,
        episodiosAssistidosTotal,
        totalEpisodiosGeral,
        newStatus,
        currentMediaType
      );

      salvarLista(db, currentUser.uid, listaCompleta, currentMediaType).then(
        (success) => {
          if (!success) {
            temporada.watched_episodes = oldValue;
            let revertedTotalAssistido = 0;
            item.temporadas.forEach((temp) => {
              revertedTotalAssistido += temp.watched_episodes || 0;
            });
            const revertedStatus = getItemStatus(item, currentMediaType);
            atualizarUIEpisodio(
              itemId,
              seasonIndex,
              oldValue,
              revertedTotalAssistido,
              totalEpisodiosGeral,
              revertedStatus,
              currentMediaType
            );
          }
        }
      );
    }

    function sortearItem() {
      const itensNaoComecados = listaCompleta.filter(
        (item) => getItemStatus(item, currentMediaType) === "nao-comecou"
      );
      if (itensNaoComecados.length === 0) {
        showConfirmationModal(
          t("app.no_random_title"),
          t("app.no_random_message"),
          () => {},
          true
        );
        return;
      }
      const itemSorteado =
        itensNaoComecados[Math.floor(Math.random() * itensNaoComecados.length)];
      showConfirmationModal(
        t("app.random_title"),
        t("app.random_message", { title: itemSorteado.title }),
        () => {},
        true
      );
    }

    function inicializarDragAndDrop() {
      if (mainListSortable) {
        mainListSortable.destroy();
        mainListSortable = null;
      }

      const isDraggable = activeSort === "personal";

      mainListSortable = new Sortable(minhaListaContainer, {
        animation: 150,
        handle: ".drag-handle-pai",
        filter: ".drag-disabled",
        onEnd: async function (evt) {
          const newIdOrder = Array.from(
            minhaListaContainer.querySelectorAll(".anime-entry")
          ).map((el) => parseInt(el.dataset.id, 10));

          listaCompleta.sort(
            (a, b) => newIdOrder.indexOf(a.id) - newIdOrder.indexOf(b.id)
          );

          const success = await salvarLista(
            db,
            currentUser.uid,
            listaCompleta,
            currentMediaType
          );

          if (!success) {
            console.error("Falha ao salvar a nova ordem da lista.");
          }
          filtrarESortearERenderizarLista();
        },
      });

      mainListSortable.option("disabled", !isDraggable);
    }

    function fecharDropdowns() {
      optionsDropdown.classList.add("hidden");
      userProfileDropdown.classList.add("hidden");
      filterDropdown.classList.add("hidden");
      sortDropdown.classList.add("hidden");
      listSwitcherDropdown.classList.add("hidden");
      listTitleBtn.classList.remove("active");
    }

    function abrirDropdown(triggerElement, menu) {
      const isVisible = !menu.classList.contains("hidden");
      fecharDropdowns();
      if (isVisible) return;

      if (menu === listSwitcherDropdown) {
        menu.classList.remove("hidden");
        triggerElement.classList.add("active");
      } else {
        const rect = triggerElement.getBoundingClientRect();
        menu.style.visibility = "hidden";
        menu.classList.remove("hidden");
        const menuHeight = menu.offsetHeight;
        menu.classList.add("hidden");
        menu.style.visibility = "visible";
        if (rect.bottom + menuHeight > window.innerHeight) {
          menu.style.top = `${rect.top - menuHeight}px`;
        } else {
          menu.style.top = `${rect.bottom + 5}px`;
        }
        if (
          menu === optionsDropdown ||
          menu === filterDropdown ||
          menu === sortDropdown
        ) {
          menu.style.left = "auto";
          menu.style.right = `${window.innerWidth - rect.right}px`;
        } else {
          menu.style.right = "auto";
          menu.style.left = `${rect.left}px`;
        }
        menu.classList.remove("hidden");
      }
    }

    // --- Event Listeners ---
    minimizeBtn.addEventListener("click", () =>
      window.electronAPI.minimizeWindow()
    );
    maximizeBtn.addEventListener("click", () =>
      window.electronAPI.maximizeWindow()
    );
    closeBtn.addEventListener("click", () => window.electronAPI.closeWindow());
    userProfileArea.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirDropdown(e.currentTarget, userProfileDropdown);
    });
    if (btnMyProfile) {
      btnMyProfile.addEventListener("click", () =>
        window.electronAPI.navigateToProfile()
      );
    }
    if (btnMyFriends) {
      btnMyFriends.addEventListener("click", () =>
        window.electronAPI.navigateToFriends()
      );
    }
    btnSettings.addEventListener("click", () =>
      window.electronAPI.navigateToSettings()
    );
    btnLogout.addEventListener("click", () => window.electronAPI.logout());
    btnBackToHub.addEventListener("click", () =>
      window.electronAPI.navigateToHub()
    );
    mostrarFormBtn.addEventListener("click", () => mudarAba("explorar"));
    pesquisaInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(filtrarESortearERenderizarLista, 300);
    });
    randomItemBtn.addEventListener("click", sortearItem);
    filterMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirDropdown(e.currentTarget, filterDropdown);
    });
    sortMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirDropdown(e.currentTarget, sortDropdown);
    });
    listTitleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      abrirDropdown(e.currentTarget, listSwitcherDropdown);
    });

    markAllWatchedBtn.addEventListener("click", () => {
      const seasonItems = seasonSelectionList.querySelectorAll(
        ".season-selection-item"
      );
      seasonItems.forEach((item) => {
        const input = item.querySelector(".episode-input-add");
        const maxVal = input.getAttribute("max");
        if (input && maxVal) {
          input.value = maxVal;
        }
      });
    });

    // NOVO EVENT LISTENER
    markAllWatchedEditBtn.addEventListener("click", () => {
      const seasonItems = editSeasonList.querySelectorAll(".edit-season-item");
      seasonItems.forEach((item) => {
        const input = item.querySelector(".episode-input");
        const maxVal = input.getAttribute("max");
        if (input && maxVal) {
          input.value = maxVal;
        }
      });
    });

    listSwitcherDropdown.addEventListener("click", (event) => {
      const target = event.target.closest(".list-option");
      if (target) {
        event.preventDefault();
        const newMediaType = target.dataset.listType;
        if (newMediaType !== currentMediaType) {
          window.electronAPI.navigateToList({ mediaType: newMediaType });
        }
        fecharDropdowns();
      }
    });

    filterDropdown.addEventListener("click", (event) => {
      const target = event.target.closest(".filter-option");
      if (target) {
        activeFilter = target.dataset.filter;
        filtrarESortearERenderizarLista();
        fecharDropdowns();
      }
    });

    sortDropdown.addEventListener("click", (event) => {
      const target = event.target.closest(".sort-option");
      if (target) {
        activeSort = target.dataset.sort;
        currentSettings.sortPreference = activeSort;
        window.electronAPI.saveSettings(currentSettings);
        filtrarESortearERenderizarLista();
        fecharDropdowns();
      }
    });

    searchModalCloseBtn.addEventListener("click", fecharModalBusca);
    searchModalBtn.addEventListener("click", buscarItem);
    searchModalInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") buscarItem();
    });
    addSelectedSeasonsBtn.addEventListener("click", adicionarItemSelecionado);

    searchModalResults.addEventListener("click", (e) => {
      const resultItem = e.target.closest(".search-result-item");
      if (resultItem) {
        const itemId = resultItem.dataset.malId;
        const title = resultItem.dataset.title;
        const itemType = resultItem.dataset.type;
        exibirTelaSelecaoTemporadas(itemId, title, itemType);
      }
    });

    const handleSeasonQuickEdit = (event) => {
      const quickEditBtn = event.target.closest(".quick-edit-btn");
      if (!quickEditBtn) return;
      const seasonItem = quickEditBtn.closest(".season-selection-item");
      const input = seasonItem.querySelector(".episode-input-add");
      let valorAtual = parseInt(input.value, 10);
      const max = parseInt(input.max, 10);
      if (quickEditBtn.classList.contains("increment-btn-add")) {
        if (isNaN(max) || valorAtual < max) valorAtual++;
      } else {
        if (valorAtual > 0) valorAtual--;
      }
      input.value = valorAtual;
    };

    seasonSelectionList.addEventListener("click", (event) => {
      const deleteBtn = event.target.closest(".delete-season-btn-add");
      if (deleteBtn) {
        deleteBtn.closest(".season-selection-item").remove();
      } else {
        handleSeasonQuickEdit(event);
      }
    });

    editModalSaveBtn.addEventListener("click", salvarEdicao);
    editModalCancelBtn.addEventListener("click", fecharModalEdicao);
    checkNewSeasonsBtn.addEventListener("click", verificarNovasTemporadas);

    const handleEditQuickEdit = (event) => {
      const quickEditBtn = event.target.closest(".quick-edit-btn");
      if (!quickEditBtn) return;
      const input = quickEditBtn.parentElement.querySelector(".episode-input");
      let valorAtual = parseInt(input.value, 10);
      const max = parseInt(input.max, 10);
      if (quickEditBtn.classList.contains("increment-btn-edit")) {
        if (isNaN(max) || valorAtual < max) valorAtual++;
      } else {
        if (valorAtual > 0) valorAtual--;
      }
      input.value = valorAtual;
    };

    editSeasonList.addEventListener("click", (event) => {
      const deleteBtn = event.target.closest(".delete-season-btn");
      if (deleteBtn) {
        deleteBtn.closest(".edit-season-item").remove();
      } else {
        handleEditQuickEdit(event);
      }
    });

    detailsModalCloseBtn.addEventListener("click", fecharModalDetalhes);

    minhaListaContainer.addEventListener("click", (event) => {
      const target = event.target;

      const addFromEmptyBtn = target.closest("#add-from-empty-btn");
      if (addFromEmptyBtn) {
        mudarAba("explorar");
        return;
      }

      const optionsBtn = target.closest(".options-btn");
      if (optionsBtn) {
        event.stopPropagation();
        const itemContainer = optionsBtn.closest(".anime-entry");
        const itemId = parseInt(itemContainer.dataset.id, 10);
        const item = listaCompleta.find((a) => a.id === itemId);
        if (item) {
          const favoriteText = btnDropdownFavorite.querySelector("span");
          const favoriteIcon = btnDropdownFavorite.querySelector("i");

          favoriteText.textContent = item.isFavorite
            ? t("app.unfavorite")
            : t("app.favorite");

          if (item.isFavorite) {
            favoriteIcon.classList.add("favorite-active");
          } else {
            favoriteIcon.classList.remove("favorite-active");
          }
        }

        optionsDropdown.dataset.id = itemContainer.dataset.id;
        abrirDropdown(optionsBtn, optionsDropdown);
        return;
      }

      const titleLink = target.closest(".anime-title-link");
      if (titleLink) {
        event.stopPropagation();
        abrirModalDetalhes(
          parseInt(titleLink.closest(".anime-entry").dataset.id, 10)
        );
        return;
      }

      const quickEditBtn = target.closest(".quick-edit-btn");
      if (quickEditBtn) {
        event.stopPropagation();
        const itemContainer = quickEditBtn.closest(".anime-entry");
        const seasonDiv = quickEditBtn.closest(".item-lista-filho");
        const input = seasonDiv.querySelector(".episode-input");
        let valorAtual = parseInt(input.value, 10) || 0;
        valorAtual += quickEditBtn.classList.contains("increment-btn") ? 1 : -1;
        atualizarEpisodio(
          parseInt(itemContainer.dataset.id, 10),
          parseInt(seasonDiv.dataset.seasonIndex, 10),
          valorAtual
        );
        return;
      }

      const parentItem = target.closest(".item-lista-pai");
      if (parentItem) {
        const isBooksOrGames =
          currentMediaType === "books" || currentMediaType === "games";
        if (isBooksOrGames) {
          return;
        }

        const itemContainer = parentItem.closest(".anime-entry");
        const seasonsWrapper = itemContainer.querySelector(".seasons-wrapper");
        const arrow = itemContainer.querySelector(".toggle-seasons-arrow");

        if (seasonsWrapper && arrow) {
          seasonsWrapper.classList.toggle("expanded");
          arrow.classList.toggle("expanded");
        }
      }
    });

    const handleInputValidation = (event) => {
      const target = event.target;
      if (
        target.matches(
          ".episode-input, .episode-input-add, .episode-input-edit"
        )
      ) {
        if (target.value === "") {
          target.value = 0;
        }
        if (target.value.length > 4) {
          target.value = target.value.slice(0, 4);
        }

        const maxAttr = target.getAttribute("max");
        if (maxAttr && !isNaN(parseInt(maxAttr, 10))) {
          const max = parseInt(maxAttr, 10);
          if (parseInt(target.value, 10) > max) {
            target.value = max;
          }
        }
      }
    };

    minhaListaContainer.addEventListener("input", handleInputValidation);
    seasonSelectionList.addEventListener("input", handleInputValidation);
    editSeasonList.addEventListener("input", handleInputValidation);

    minhaListaContainer.addEventListener("change", (event) => {
      const target = event.target;
      if (target.classList.contains("episode-input")) {
        event.stopPropagation();
        const itemContainer = target.closest(".anime-entry");
        const seasonDiv = target.closest(".item-lista-filho");
        const itemId = parseInt(itemContainer.dataset.id, 10);
        const seasonIndex = parseInt(seasonDiv.dataset.seasonIndex, 10);
        const novoValor = parseInt(target.value, 10);
        atualizarEpisodio(itemId, seasonIndex, novoValor);
      }

      if (target.classList.contains("status-selector")) {
        const itemId = parseInt(target.dataset.itemId, 10);
        let newStatus = target.value;
        const item = listaCompleta.find((a) => a.id === itemId);

        if (item) {
          if (newStatus === "concluido") {
            newStatus = "finished";
          }
          item.userStatus = newStatus;

          if (newStatus === "finished") {
            item.temporadas.forEach(
              (t) => (t.watched_episodes = t.episodes || 1)
            );
          } else if (newStatus === "nao-comecou") {
            item.temporadas.forEach((t) => (t.watched_episodes = 0));
          }

          salvarLista(db, currentUser.uid, listaCompleta, currentMediaType);
          filtrarESortearERenderizarLista();
        }
      }
    });

    optionsDropdown.addEventListener("click", (e) => e.stopPropagation());
    userProfileDropdown.addEventListener("click", (e) => e.stopPropagation());

    btnDropdownFavorite.addEventListener("click", () => {
      const itemId = parseInt(optionsDropdown.dataset.id, 10);
      const item = listaCompleta.find((a) => a.id === itemId);
      if (item) {
        item.isFavorite = !item.isFavorite;
        salvarLista(db, currentUser.uid, listaCompleta, currentMediaType);
        filtrarESortearERenderizarLista();
      }
      fecharDropdowns();
    });

    btnDropdownEdit.addEventListener("click", () => {
      abrirModalEdicao(parseInt(optionsDropdown.dataset.id, 10));
      fecharDropdowns();
    });
    btnDropdownDelete.addEventListener("click", () => {
      const itemId = parseInt(optionsDropdown.dataset.id, 10);
      const item = listaCompleta.find((a) => a.id === itemId);
      if (item) {
        showConfirmationModal(
          t("app.delete_item_title"),
          t("app.delete_item_message", { title: item.title }),
          () => apagarItem(itemId)
        );
      }
      fecharDropdowns();
    });

    statusModalOptions.addEventListener("click", (event) => {
      const target = event.target.closest(".status-option-btn");
      if (target) {
        const status = target.dataset.status;
        adicionarItemDireto(status);
        fecharModalStatus();
      }
    });
    statusModalCancelBtn.addEventListener("click", fecharModalStatus);

    window.addEventListener("click", fecharDropdowns);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (searchModalOverlay.classList.contains("visible")) {
          fecharModalBusca();
        } else if (editModalOverlay.classList.contains("visible")) {
          fecharModalEdicao();
        } else if (detailsModalOverlay.classList.contains("visible")) {
          fecharModalDetalhes();
        } else if (statusModalOverlay.classList.contains("visible")) {
          fecharModalStatus();
        } else if (!modalOverlay.classList.contains("hidden")) {
          hideModal();
        }
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        if (
          searchModalOverlay.classList.contains("visible") &&
          !seasonSelectionView.classList.contains("hidden")
        ) {
          addSelectedSeasonsBtn.click();
        } else if (editModalOverlay.classList.contains("visible")) {
          editModalSaveBtn.click();
        } else if (modalOverlay.classList.contains("visible")) {
          modalBtnConfirm.click();
        }
      }
    });

    window.electronAPI.onUpdateReady(() => {
      updateNotification.classList.remove("hidden");
      setTimeout(() => updateNotification.classList.add("visible"), 10);
    });

    if (updateNowBtn) {
      updateNowBtn.addEventListener("click", () => {
        window.electronAPI.quitAndInstallUpdate();
      });
    }
  } catch (error) {
    console.error("Erro no DOMContentLoaded do app.js:", error);
    showErrorModal(
      "Erro Crítico",
      "Ocorreu um erro inesperado ao iniciar a aplicação."
    );
  }
});
