import { translateText } from "../utils/translate.js";

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
    const response = await window.electronAPI.getMediaDetails("anime", id);
    if (response.error) {
      console.error("Erro ao buscar detalhes do anime:", response.message);
      return null;
    }
    const animeCompleto = response.data;

    if (!animeCompleto) return null;

    const baseTitle = animeCompleto.title_japanese || animeCompleto.title;

    // A busca interna por temporadas agora também será filtrada pelo main.js
    const searchResults = await this.search(baseTitle);

    const animeBaseTitleNormalized = (
      animeCompleto.title_english || animeCompleto.title
    ).toLowerCase();

    const todasTemporadas = searchResults.filter((item) => {
      const itemTitle = (item.title_english || item.title).toLowerCase();
      // Garante que estamos a comparar animes com títulos que começam da mesma forma
      return itemTitle.startsWith(animeBaseTitleNormalized);
    });

    if (!todasTemporadas.some((t) => t.mal_id === animeCompleto.mal_id)) {
      todasTemporadas.push(animeCompleto);
    }

    todasTemporadas.sort((a, b) => a.title.localeCompare(b.title));

    animeCompleto.temporadas = todasTemporadas;
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

      if (cachedSynopsis) {
        animeCompleto.synopsis = cachedSynopsis;
      } else {
        animeCompleto.synopsis = await translateText(
          animeCompleto.synopsis,
          lang
        );
        sessionStorage.setItem(cacheKey, animeCompleto.synopsis);
      }

      return animeCompleto;
    } catch (error) {
      console.error(
        "Não foi possível buscar detalhes atualizados do anime, usando dados locais:",
        error
      );
      return {
        title: localItem.title,
        synopsis: localItem.synopsis || "Sinopse não disponível.",
        images: { jpg: { large_image_url: localItem.image_url } },
        score: "N/A",
        type: "Anime",
        status: "",
        episodes: localItem.temporadas.reduce(
          (acc, s) => acc + (s.episodes || 0),
          0
        ),
        genres: [],
      };
    }
  },
};
