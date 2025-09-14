function formatNumberWithPadding(current, max) {
  const currentStr = String(current);
  return `<span>${currentStr}</span>`;
}

export function getItemStatus(item, mediaType) {
  const isSpecialStatusType = mediaType === "books" || mediaType === "games";
  if (isSpecialStatusType && item.userStatus) {
    return item.userStatus;
  }

  let totalEpisodios = 0;
  let episodiosAssistidos = 0;
  let temTemporadaFutura = false;

  (item.temporadas || []).forEach((temp) => {
    const eps = temp.episodes || 0;
    totalEpisodios += eps;
    episodiosAssistidos += temp.watched_episodes || 0;
    if (eps === 0) {
      temTemporadaFutura = true;
    }
  });

  if (episodiosAssistidos === 0) return "nao-comecou";
  if (totalEpisodios > 0 && episodiosAssistidos === totalEpisodios) {
    return temTemporadaFutura ? "concluido" : "finished";
  }
  if (episodiosAssistidos > 0) return "assistindo";

  return "nao-comecou";
}

export function renderizarLista(
  listaItems,
  containerElement,
  t,
  mediaType,
  activeSort
) {
  containerElement.innerHTML = "";

  const cabecalhoEpisodios = document.querySelector(
    ".cabecalho-lista .col-episodios-pai"
  );
  if (cabecalhoEpisodios) {
    const headerKeyMap = {
      anime: "app.list_header_episodes",
      series: "app.list_header_episodes",
      manga: "app.list_header_chapters",
      comics: "app.list_header_chapters",
      books: "app.list_header_pages",
      movies: "app.list_header_watched",
      games: "app.list_header_played",
    };
    cabecalhoEpisodios.textContent = t(
      headerKeyMap[mediaType] || "app.list_header_episodes"
    );
  }

  if (listaItems.length === 0) {
    const emptyListHTML = `
        <div class="empty-list-container">
          <button id="add-from-empty-btn" class="button-primary">
            <i class="fas fa-plus"></i> Adicionar Item
          </button>
          </br>
          </br>
          </br>
          </br>
          <p>${t("app.empty_list")}</p>
        </div>
      `;
    containerElement.innerHTML = emptyListHTML;
    return;
  }

  const dragDisabledClass = activeSort !== "personal" ? "drag-disabled" : "";

  const fragment = document.createDocumentFragment();
  listaItems.forEach((item) => {
    if (!item.title || !item.temporadas) return;

    const itemContainer = document.createElement("div");
    itemContainer.className = "anime-entry";
    itemContainer.dataset.id = item.id;

    let totalEpisodios = 0,
      episodiosAssistidos = 0;
    let hasKnownEpisodes = false;

    (item.temporadas || []).forEach((temp) => {
      episodiosAssistidos += temp.watched_episodes || 0;
      if (temp.episodes && temp.episodes > 0) {
        totalEpisodios += temp.episodes;
        hasKnownEpisodes = true;
      }
    });

    const isBooksOrGames = mediaType === "books" || mediaType === "games";

    const displayTotal = isBooksOrGames
      ? 1
      : hasKnownEpisodes
      ? totalEpisodios
      : "?";

    const status = getItemStatus(item, mediaType);
    const statusClass = `status-${status}`;

    let subtextHtml = "";
    if (mediaType === "books" && item.authors && item.authors.length > 0) {
      subtextHtml = `<small class="item-author">${item.authors.join(
        ", "
      )}</small>`;
    } else if (mediaType === "comics" && item.publisherName) {
      subtextHtml = `<small class="item-author">${item.publisherName}</small>`;
    }

    let episodiosHTML;
    if (isBooksOrGames) {
      const statusAtual = item.userStatus || "nao-comecou";
      const mediaTypeSuffix = mediaType === "books" ? "books" : "games";
      episodiosHTML = `
              <div class="col-episodios-pai">
                  <select class="status-selector" data-item-id="${item.id}">
                      <option value="nao-comecou" ${
                        statusAtual === "nao-comecou" ? "selected" : ""
                      }>${t(
        `app.status_not_started_${mediaTypeSuffix}`
      )}</option>
                      <option value="assistindo" ${
                        statusAtual === "assistindo" ? "selected" : ""
                      }>${t(
        `app.status_in_progress_${mediaTypeSuffix}`
      )}</option>
                      <option value="finished" ${
                        statusAtual === "finished" ||
                        statusAtual === "concluido"
                          ? "selected"
                          : ""
                      }>${t(`app.status_completed_${mediaTypeSuffix}`)}</option>
                  </select>
              </div>`;
    } else {
      const watchedFormatted = formatNumberWithPadding(
        episodiosAssistidos,
        displayTotal
      );
      episodiosHTML = `<div class="col-episodios-pai"><div class="episode-display"><span class="watched">${watchedFormatted}</span><span class="separator">/</span><span class="total">${displayTotal}</span></div></div>`;
    }

    const toggleArrowClass = isBooksOrGames ? "hidden-arrow" : "";

    const paiDiv = document.createElement("div");
    paiDiv.className = "item-lista-pai";
    paiDiv.innerHTML = `
          <div class="col-drag"><i class="fas fa-grip-vertical drag-handle-pai ${dragDisabledClass}"></i></div>
          <div class="col-toggle ${toggleArrowClass}"><i class="fas fa-chevron-right toggle-seasons-arrow"></i></div>
          <div class="col-status"><div class="status-bar ${statusClass}"></div></div>
          <div class="col-nome-pai">
              <span class="coluna-nome anime-title-link" data-id="${item.id}" title="${item.title}">${item.title}</span>
              ${subtextHtml}
          </div>
          ${episodiosHTML}
          <div class="col-acoes-pai"><button class="options-btn" title="Opções"><i class="fas fa-ellipsis-v"></i></button></div>`;

    const seasonsWrapper = document.createElement("div");
    seasonsWrapper.className = "seasons-wrapper";

    if (!isBooksOrGames) {
      (item.temporadas || []).forEach((temporada, index) => {
        const maxVal = temporada.episodes || 0;
        const maxAttr = maxVal > 0 ? `max="${maxVal}"` : 'maxlength="4"';
        const displayTotalFilho = temporada.episodes || "?";
        const filhoDiv = document.createElement("div");
        filhoDiv.className = "item-lista-filho";
        filhoDiv.dataset.seasonIndex = index;
        filhoDiv.innerHTML = `
                  <span class="season-title">${temporada.title}</span>
                  <div class="episode-controls">
                      <button class="quick-edit-btn decrement-btn">-</button>
                      <input type="number" class="episode-input" value="${
                        temporada.watched_episodes || 0
                      }" min="0" ${maxAttr}>
                      <span class="episode-total">/ ${displayTotalFilho}</span>
                      <button class="quick-edit-btn increment-btn">+</button>
                  </div>`;
        seasonsWrapper.appendChild(filhoDiv);
      });
    }

    itemContainer.appendChild(paiDiv);
    itemContainer.appendChild(seasonsWrapper);
    fragment.appendChild(itemContainer);
  });
  containerElement.appendChild(fragment);
}

export function renderizarSelecaoTemporadas(
  temporadas,
  containerElement,
  mediaType,
  t
) {
  const headerKeyMap = {
    anime: "app.list_header_episodes",
    series: "app.list_header_episodes",
    manga: "app.list_header_chapters",
    comics: "app.list_header_chapters",
    books: "app.list_header_pages",
    movies: "app.list_header_watched",
    games: "app.list_header_played",
  };
  const isSingleUnit =
    mediaType === "movies" ||
    mediaType === "books" ||
    mediaType === "comics" ||
    mediaType === "games";
  const titleHeader = isSingleUnit
    ? t("app.title_singular", "Título")
    : t("app.title_plural", "Temporada/Volume");
  const watchedHeader = t(headerKeyMap[mediaType]);

  containerElement.innerHTML = `<div class="season-selection-header"><span>${titleHeader}</span><span>${watchedHeader}</span></div>`;
  const list = document.createElement("ul");
  list.className = "season-list-sortable";
  temporadas.forEach((temp, index) => {
    const maxVal = isSingleUnit ? 1 : temp.episodes || 0;
    const maxAttr = maxVal > 0 ? `max="${maxVal}"` : "";
    const displayTotalModal = isSingleUnit ? 1 : temp.episodes || "?";
    const li = document.createElement("li");
    li.className = "season-selection-item";
    li.dataset.originalIndex = index;
    li.innerHTML = `
            <i class="fas fa-grip-vertical drag-handle"></i>
            <div class="season-info-add"><strong title="${temp.title}">${temp.title}</strong></div>
            <div class="episode-controls">
                <button class="quick-edit-btn decrement-btn-add">-</button>
                <input type="number" class="episode-input-add" value="0" min="0" ${maxAttr} maxlength="4">
                <span class="episode-total">/ ${displayTotalModal}</span>
                <button class="quick-edit-btn increment-btn-add">+</button>
            </div>
            <button class="delete-season-btn-add" title="Remover"><i class="fas fa-times"></i></button>`;
    list.appendChild(li);
  });
  containerElement.appendChild(list);
}

export function renderizarListaEdicao(
  item,
  containerElement,
  sortableInstance,
  mediaType,
  t,
  isCustom = false
) {
  if (sortableInstance) {
    sortableInstance.destroy();
  }

  const headerKeyMap = {
    anime: "app.list_header_episodes",
    series: "app.list_header_episodes",
    manga: "app.list_header_chapters",
    comics: "app.list_header_chapters",
    books: "app.list_header_pages",
    movies: "app.list_header_watched",
    games: "app.list_header_played",
  };
  const isSingleUnit =
    mediaType === "movies" ||
    mediaType === "books" ||
    mediaType === "comics" ||
    mediaType === "games";
  const titleHeader = isSingleUnit
    ? t("app.title_singular", "Título")
    : t("app.title_plural", "Temporada/Volume");
  const episodesHeader = t(headerKeyMap[mediaType]);

  containerElement.innerHTML = `<div class="edit-season-header"><span>${titleHeader}</span><span>${episodesHeader}</span></div>`;
  const list = document.createElement("ul");
  list.className = "edit-list-sortable";
  item.temporadas.forEach((temporada) => {
    const titleField = isCustom
      ? `<input type="text" class="edit-season-title-input" value="${temporada.title}">`
      : `<strong title="${temporada.title}">${temporada.title}</strong>`;

    const episodesField = isCustom
      ? `<span class="episode-total-barra">/</span><input type="number" class="episode-input-total" value="${
          temporada.episodes || 0
        }" min="0">`
      : `<span class="episode-total">/ ${temporada.episodes || "?"}</span>`;

    const maxVal = temporada.episodes || 0;
    const maxAttr = maxVal > 0 ? `max="${maxVal}"` : 'maxlength="4"';

    const li = document.createElement("li");
    li.className = "edit-season-item";
    li.dataset.originalTitle = temporada.title;
    li.innerHTML = `
                    <i class="fas fa-grip-vertical drag-handle"></i>
                    <div class="edit-season-info">${titleField}</div>
                    <div class="episode-controls">
                        <button class="quick-edit-btn decrement-btn-edit">-</button>
                        <input type="number" class="episode-input" value="${
                          temporada.watched_episodes || 0
                        }" min="0" ${maxAttr}>
                        ${episodesField}
                        <button class="quick-edit-btn increment-btn-edit">+</button>
                    </div>
                    <button class="delete-season-btn" title="Apagar"><i class="fas fa-times"></i></button>`;
    list.appendChild(li);
  });
  containerElement.appendChild(list);

  return new Sortable(list, {
    animation: 150,
    handle: ".drag-handle",
  });
}

export function renderizarDetalhesAnime(item, t, mediaType) {
  const content = document.getElementById("details-modal-content");
  if (!item) {
    content.innerHTML = `<div class="spinner" style="margin: 20px auto;"></div><p>${t(
      "app.details_modal_loading"
    )}</p>`;
    return;
  }

  const unitKeyMap = {
    anime: "app.details_episodes",
    series: "app.details_episodes",
    manga: "app.details_chapters",
    comics: "app.details_chapters",
    books: "app.details_pages",
    movies: "app.details_parts",
    games: "app.details_parts",
  };
  const unitText = t(unitKeyMap[mediaType] || "app.details_parts");
  const genres =
    item.genres?.map((g) => `<span>${g.name}</span>`).join("") || "";

  let authorHtml = "";
  if (item.authors && item.authors.length > 0) {
    authorHtml = `<p><strong>${t(
      "app.list_header_author",
      "Autor"
    )}:</strong> ${item.authors.map((a) => a.name).join(", ")}</p>`;
  }

  content.innerHTML = `
      <img id="details-modal-img" src="${
        item.images?.jpg?.large_image_url ||
        "https://placehold.co/150x210/1f1f1f/ffffff?text=Capa"
      }" alt="Poster de ${item.title}" />
      <div id="details-modal-info">
          <h2 id="details-modal-title">${
            item.title || "Título não disponível"
          }</h2>
          ${authorHtml}
          <div class="details-pills">
          <span>⭐ ${item.score || "N/A"}</span>
          <span>${item.type || "N/A"}</span>
          <span>${item.status || "N/A"}</span>
          <span>${item.episodes || "?"} ${unitText}</span>
          </div>
          <p id="details-modal-synopsis">${
            item.synopsis || "Sinopse não disponível."
          }</p>
          <div class="details-pills">${genres}</div>
          ${
            item.url
              ? `<a href="${item.url}" id="mal-link" class="button-primary" style="margin-top: 10px; text-decoration: none; text-align: center; font-size: 0.9em; padding: 8px 15px; display: inline-block; width: auto;">Ver no MyAnimeList</a>`
              : ""
          }
      </div>`;

  const malLink = content.querySelector("#mal-link");
  if (malLink) {
    malLink.addEventListener("click", (e) => {
      e.preventDefault();
      window.electronAPI.openExternalLink(malLink.href);
    });
  }
}

export function atualizarUIEpisodio(
  itemId,
  seasonIndex,
  novoValorAssistido,
  totalAssistido,
  totalGeral,
  status,
  mediaType
) {
  const itemContainer = document.querySelector(
    `.anime-entry[data-id="${itemId}"]`
  );
  if (!itemContainer) return;

  const isSpecialStatusType = mediaType === "books" || mediaType === "games";

  const item = { temporadas: [{ episodes: totalGeral }] };
  let hasKnownEpisodesUpdate = false;
  if (item.temporadas) {
    item.temporadas.forEach((temp) => {
      if (temp.episodes) hasKnownEpisodesUpdate = true;
    });
  }
  const displayTotalUpdate = hasKnownEpisodesUpdate ? totalGeral : "?";

  if (!isSpecialStatusType) {
    const contadorPai = itemContainer.querySelector(
      ".col-episodios-pai .episode-display .watched"
    );
    const totalPai = itemContainer.querySelector(
      ".col-episodios-pai .episode-display .total"
    );
    if (contadorPai)
      contadorPai.innerHTML = formatNumberWithPadding(
        totalAssistido,
        displayTotalUpdate
      );
    if (totalPai) totalPai.textContent = displayTotalUpdate;
  }

  const statusBar = itemContainer.querySelector(".status-bar");
  if (statusBar) {
    statusBar.className = "status-bar";
    if (status) statusBar.classList.add(`status-${status}`);
  }
  const seasonDiv = itemContainer.querySelector(
    `.item-lista-filho[data-season-index="${seasonIndex}"]`
  );
  if (seasonDiv) {
    const input = seasonDiv.querySelector(".episode-input");
    if (input && parseInt(input.value, 10) !== novoValorAssistido)
      input.value = novoValorAssistido;
  }
}

export function renderizarResultadosBusca(resultados, containerElement, t) {
  containerElement.innerHTML = "";
  if (!resultados || resultados.length === 0) {
    containerElement.innerHTML = `<p style="text-align: center; padding: 20px;">${t(
      "app.add_modal_no_results"
    )}</p>`;
    return;
  }
  resultados.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "search-result-item";
    itemDiv.dataset.malId = item.mal_id;
    itemDiv.dataset.title = item.title;
    itemDiv.dataset.type = item.type;

    let subText = "";
    if (item.type === "HQ (Volume)") {
      subText = item.volumeName || item.type;
    } else if (item.authors && item.authors.length > 0) {
      subText = item.authors.map((a) => a.name).join(", ");
    } else {
      subText = item.type || "";
    }

    itemDiv.innerHTML = `
              <img src="${
                item.images.jpg.image_url ||
                "https://placehold.co/50x70/1f1f1f/ffffff?text=N/A"
              }" alt="Poster de ${item.title}">
              <div class="search-result-item-info">
                  <strong title="${item.title}">${item.title}</strong>
                  <small>${subText}</small>
              </div>`;
    containerElement.appendChild(itemDiv);
  });
}

export function atualizarPerfilUsuario(userData) {
  const userProfileArea = document.getElementById("user-profile-area");
  const userNickname = document.getElementById("user-nickname");
  const userAvatar = document.getElementById("user-avatar");

  if (userProfileArea && userData) {
    userNickname.textContent = userData.displayName;
    userAvatar.src = userData.photoURL;
    userAvatar.onerror = () => {
      userAvatar.src = "https://placehold.co/40x40/1f1f1f/ffffff?text=U";
    };
    userProfileArea.classList.remove("loading-skeleton");
  }
}
