import { translateText } from "../utils/translate.js";

// Função auxiliar para evitar loops infinitos e chamadas duplicadas
const processedIdsForSequels = new Set();

// Função recursiva para encontrar a primeira temporada de uma série
async function findFirstSeason(animeData) {
  if (!animeData.relations || animeData.relations.length === 0) {
    return animeData;
  }

  const prequel = animeData.relations
    .flatMap((r) => r.entry)
    .find(
      (e) =>
        e.type === "anime" &&
        animeData.relations.some(
          (r) =>
            r.relation === "Prequel" &&
            r.entry.some((re) => re.mal_id === e.mal_id)
        )
    );

  if (prequel) {
    const prequelResponse = await window.electronAPI.getMediaDetails(
      "anime",
      prequel.mal_id
    );
    if (!prequelResponse.error && prequelResponse.data) {
      // Chamada recursiva para continuar buscando a primeira temporada
      return findFirstSeason(prequelResponse.data);
    }
  }

  return animeData;
}

// Função recursiva para construir a linha do tempo a partir da primeira temporada
async function buildWatchOrder(animeData, seasonList) {
  if (processedIdsForSequels.has(animeData.mal_id)) {
    return;
  }

  seasonList.push(animeData);
  processedIdsForSequels.add(animeData.mal_id);

  if (!animeData.relations || animeData.relations.length === 0) {
    return;
  }

  const sequel = animeData.relations
    .flatMap((r) => r.entry)
    .find(
      (e) =>
        e.type === "anime" &&
        animeData.relations.some(
          (r) =>
            r.relation === "Sequel" &&
            r.entry.some((re) => re.mal_id === e.mal_id)
        )
    );

  if (sequel) {
    const sequelResponse = await window.electronAPI.getMediaDetails(
      "anime",
      sequel.mal_id
    );
    if (!sequelResponse.error && sequelResponse.data) {
      // Chamada recursiva para adicionar a próxima temporada
      await buildWatchOrder(sequelResponse.data, seasonList);
    }
  }
}

export const animeService = {
  async search(term) {
    const response = await window.electronAPI.searchMedia("anime", term);
    if (response.error) {
      console.error("Erro ao buscar animes:", response.message);
      return [];
    }
    return response.data || [];
  },

  async getDetails(id) {
    processedIdsForSequels.clear(); // Limpa o controle de IDs processados a cada nova busca

    const initialResponse = await window.electronAPI.getMediaDetails(
      "anime",
      id
    );
    if (initialResponse.error || !initialResponse.data) {
      console.error(
        "Erro ao buscar detalhes do anime inicial:",
        initialResponse.message
      );
      return null;
    }

    // 1. Encontra a primeira temporada da série
    const firstSeason = await findFirstSeason(initialResponse.data);

    // 2. A partir da primeira temporada, monta a ordem cronológica correta
    const orderedSeasons = [];
    await buildWatchOrder(firstSeason, orderedSeasons);

    // 3. Retorna o anime original, mas com a lista de temporadas corrigida e ordenada
    const animeCompleto = initialResponse.data;
    animeCompleto.temporadas = orderedSeasons;

    return animeCompleto;
  },

  async getDisplayDetails(localItem, lang) {
    if (localItem.isCustom) {
      return Promise.resolve({
        ...localItem,
        episodes: localItem.temporadas.reduce(
          (acc, s) => acc + (s.episodes || 0),
          0
        ),
        images: { jpg: { large_image_url: localItem.image_url } },
        score: "N/A",
        type: "Anime",
        status: "",
        genres: [],
      });
    }

    if (localItem.genres && localItem.genres.length > 0) {
      return Promise.resolve(localItem);
    }

    try {
      const cacheKey = `synopsis_${localItem.mal_id}_${lang}`;
      const cachedSynopsis = sessionStorage.getItem(cacheKey);

      let malId = localItem.mal_id;
      if (!malId) {
        const searchResults = await this.search(localItem.title);
        if (searchResults.length > 0) {
          malId = searchResults[0].mal_id;
        } else {
          throw new Error("Anime não encontrado na API para obter mal_id.");
        }
      }

      const response = await window.electronAPI.getMediaDetails("anime", malId);
      if (response.error || !response.data) {
        throw new Error("Falha ao obter detalhes da API Jikan.");
      }

      const animeCompleto = response.data;

      if (cachedSynopsis && lang !== "en") {
        animeCompleto.synopsis = cachedSynopsis;
      } else {
        animeCompleto.synopsis = await translateText(
          animeCompleto.synopsis,
          lang
        );
        if (lang !== "en")
          sessionStorage.setItem(cacheKey, animeCompleto.synopsis);
      }

      return animeCompleto;
    } catch (error) {
      console.error(
        "Não foi possível buscar detalhes atualizados do anime, usando dados locais:",
        error
      );
      return {
        ...localItem,
        episodes: localItem.temporadas.reduce(
          (acc, s) => acc + (s.episodes || 0),
          0
        ),
        images: { jpg: { large_image_url: localItem.image_url } },
        score: "N/A",
        type: "Anime",
        status: "",
        genres: [],
      };
    }
  },
};
