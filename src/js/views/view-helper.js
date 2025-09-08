import { translateText } from "../utils/translate.js";

function cleanComicSynopsis(description) {
  if (!description) {
    return "Sinopse não disponível.";
  }

  let cleaned = description.replace(/<[^>]*>/g, "").trim();

  const boilerplateTexts = ["French publication."];

  if (
    boilerplateTexts.includes(cleaned) ||
    cleaned.length < 20 ||
    !/[a-zA-Z]/.test(cleaned)
  ) {
    return "Sinopse não disponível.";
  }

  return cleaned;
}

export async function applyTranslations(lang) {
  const response = await fetch(`../locales/${lang}.json`);
  const translations = await response.json();

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key.startsWith("[") && key.includes("]")) {
      const match = key.match(/\[(.*?)\](.*)/);
      if (match) {
        const attr = match[1];
        const actualKey = match[2];
        const translation =
          actualKey
            .split(".")
            .reduce((obj, i) => (obj ? obj[i] : null), translations) ||
          actualKey;
        element.setAttribute(attr, translation);
      }
    } else {
      element.innerHTML =
        key
          .split(".")
          .reduce((obj, i) => (obj ? obj[i] : null), translations) || key;
    }
  });

  return (key, fallback = "") => {
    const keys = key.split(".");
    let result = translations;
    for (const k of keys) {
      result = result[k];
      if (result === undefined) return fallback || key;
    }
    return result;
  };
}

export function renderResults(items, container, t, mediaType) {
  container.innerHTML = "";
  if (!items || items.length === 0) {
    container.innerHTML = `<p class="placeholder-text">${t(
      "app.add_modal_no_results",
      "Nenhum resultado encontrado."
    )}</p>`;
    return;
  }
  items.forEach((item) => {
    if (!item || (!item.title && !item.name)) return;

    let norm = {};
    const itemSpecificType = item.type || item.media_type;
    const normalizedTitle = item.title || item.name;

    if (mediaType === "books") {
      const authors =
        item.authors && item.authors.length > 0
          ? item.authors.map((a) => a.name)
          : item.author_name || [];

      norm = {
        id: item.key,
        title: normalizedTitle,
        subtitle: authors.join(", ") || "Autor desconhecido",
        image_url:
          item.cover_i || item.cover_id
            ? `https://covers.openlibrary.org/b/id/${
                item.cover_i || item.cover_id
              }-M.jpg`
            : "https://placehold.co/160x220/1f1f1f/ffffff?text=Capa",
        score: "N/A",
        type: "books",
      };
    } else if (mediaType === "comics") {
      norm = {
        id: item.id || item.mal_id,
        title: `${item.name} (${item.start_year || "N/A"})`,
        subtitle:
          item.volumeName || item.publisher?.name || "Editora desconhecida",
        image_url:
          item.image?.medium_url ||
          item.images?.jpg?.image_url ||
          "https://placehold.co/160x220/1f1f1f/ffffff?text=Capa",
        score: "N/A",
        type: item.type || "comics",
      };
    } else if (mediaType === "games") {
      norm = {
        id: item.guid,
        title: normalizedTitle,
        subtitle: "Game",
        image_url:
          item.image?.medium_url ||
          "https://placehold.co/160x220/1f1f1f/ffffff?text=Capa",
        score: "N/A",
        type: "games",
      };
    } else {
      let subtitle = item.type || item.media_type;
      if (mediaType === "series" && !subtitle) {
        subtitle = "Série";
      } else if (subtitle === "movie") {
        subtitle = "Filme";
      } else if (subtitle === "collection") {
        subtitle = "Coleção";
      }

      let finalType = itemSpecificType || mediaType;
      if (mediaType === "anime") finalType = "anime";
      if (mediaType === "manga") finalType = "manga";

      norm = {
        id: item.id || item.mal_id,
        title: normalizedTitle,
        subtitle: subtitle,
        image_url:
          item.images?.jpg?.large_image_url ||
          (item.poster_path
            ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
            : item.image?.thumb_url ||
              item.volumeInfo?.imageLinks?.thumbnail ||
              "https://placehold.co/160x220/1f1f1f/ffffff?text=Capa"),
        score:
          item.score ||
          item.vote_average?.toFixed(1) ||
          item.volumeInfo?.averageRating ||
          "N/A",
        type: finalType,
      };
    }

    if (!norm.title || !norm.id) {
      console.warn(
        "[view-helper] Item pulado por falta de título ou ID:",
        item
      );
      return;
    }

    const authorsDataset =
      mediaType === "books" && (item.author_name || item.authors)
        ? `data-authors='${JSON.stringify(
            item.author_name || item.authors.map((a) => a.name)
          )}'`
        : "";

    const card = document.createElement("div");
    card.className = "anime-card";
    card.innerHTML = `
      <a class="anime-card-image-link" data-id="${norm.id}" data-type="${
      norm.type
    }">
        <img src="${norm.image_url}" alt="Capa de ${norm.title}" loading="lazy">
      </a>
      <div class="anime-card-info">
        <h3 title="${norm.title}">${norm.title}</h3>
        <p>${norm.subtitle}</p> 
        <button class="button-primary anime-card-add-btn" data-id="${
          norm.id
        }" data-title="${norm.title}" data-type="${
      norm.type
    }" ${authorsDataset}>${t(
      "app.add_to_list_button",
      "Adicionar à Lista"
    )}</button>
      </div>
    `;
    container.appendChild(card);
  });
}

export async function renderDetailsModalContent(
  itemData,
  lang,
  t,
  mediaType,
  detailsModalContent
) {
  const data = itemData.data || itemData.results || itemData;
  let details = {};
  const normalizedTitle = data.title || data.name;

  if (mediaType === "comics" || (data.publisher && mediaType !== "series")) {
    details = {
      title: normalizedTitle,
      image_url: data.image?.super_url,
      score: "N/A",
      type_label: "HQ (Volume)",
      status: data.publisher?.name || "",
      episodes: (data.issues || []).length,
      synopsis: cleanComicSynopsis(data.description),
      authors: "",
      genres: "",
    };
  } else if (mediaType === "anime" || mediaType === "manga") {
    details = {
      title: normalizedTitle,
      image_url: data.images.jpg.large_image_url,
      score: data.score,
      type_label: data.type,
      status: data.status,
      episodes: data.chapters || data.episodes,
      synopsis: await translateText(data.synopsis, lang),
      genres: (data.genres || []).map((g) => `<span>${g.name}</span>`).join(""),
      authors: (data.authors || []).map((a) => a.name).join(", "),
    };
  } else if (
    mediaType === "movie" ||
    mediaType === "movies" ||
    mediaType === "collection" ||
    mediaType === "series"
  ) {
    details = {
      title: normalizedTitle,
      image_url: data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : "",
      score: data.vote_average?.toFixed(1),
      type_label:
        mediaType === "movie" || mediaType === "movies"
          ? "Filme"
          : mediaType === "collection"
          ? "Coleção"
          : "Série",
      status: data.status,
      episodes: data.number_of_episodes || (data.parts || []).length,
      synopsis: await translateText(data.overview, lang),
      genres: (data.genres || []).map((g) => `<span>${g.name}</span>`).join(""),
      authors: "",
    };
  } else if (mediaType === "books") {
    const cleanedSubjects = (data.subjects || [])
      .filter(
        (s) =>
          s.length < 30 &&
          !s.includes("(Fictitious character)") &&
          !s.includes("--")
      )
      .slice(0, 10);

    details = {
      title: normalizedTitle,
      image_url: data.covers
        ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`
        : "https://placehold.co/150x210",
      score: "N/A",
      type_label: "Livro",
      status: data.first_publish_date || "",
      episodes: data.number_of_pages_median || "N/A",
      synopsis: await translateText(
        data.description
          ? typeof data.description === "string"
            ? data.description
            : data.description.value
          : "Sinopse não disponível.",
        lang
      ),
      genres: cleanedSubjects.map((g) => `<span>${g}</span>`).join(""),
      authors:
        data.authors && data.authors[0]?.name ? data.authors[0].name : "",
    };
  } else if (mediaType === "games") {
    details = {
      title: normalizedTitle,
      image_url: data.image?.super_url || "https://placehold.co/150x210",
      score: "N/A",
      type_label: "Game",
      status: data.original_release_date
        ? `Lançado em: ${new Date(
            data.original_release_date
          ).toLocaleDateString()}`
        : "Data de lançamento desconhecida",
      episodes: 1,
      synopsis:
        (await translateText(data.deck, lang)) || "Sinopse não disponível.",
      genres: (data.genres || []).map((g) => `<span>${g.name}</span>`).join(""),
      authors: "",
    };
  }

  let authorHtml = "";
  if (details.authors) {
    authorHtml = `<p><strong>Autores:</strong> ${details.authors}</p>`;
  }

  detailsModalContent.innerHTML = `
        <img id="details-modal-img" src="${
          details.image_url || "https://placehold.co/150x210"
        }" alt="Capa de ${details.title}" />
        <div id="details-modal-info">
          <h2 id="details-modal-title">${
            details.title || "Título não encontrado"
          }</h2>
          ${authorHtml}
          <div class="details-pills">
            <span>⭐ ${details.score || "N/A"}</span>
            <span>${details.type_label || "N/A"}</span>
            <span>${details.status || "N/A"}</span>
            ${
              details.episodes
                ? `<span>${details.episodes} ${t(
                    "app.details_parts",
                    "partes"
                  )}</span>`
                : ""
            }
          </div>
          <p id="details-modal-synopsis">${
            details.synopsis || "Sinopse não disponível."
          }</p>
          <div class="details-pills">${details.genres}</div>
        </div>`;
}
