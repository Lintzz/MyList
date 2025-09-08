import { translateText } from "../utils/translate.js";

export const mangaService = {
  async search(term) {
    const response = await window.electronAPI.searchMedia("manga", term);
    if (response.error) {
      console.error("Erro ao buscar mangás:", response.message);
      return [];
    }
    return (response.data || []).map((item) => ({
      ...item,
      episodes: item.chapters,
      type: "Mangá",
    }));
  },

  async getDetails(id) {
    const response = await window.electronAPI.getMediaDetails("manga", id);
    if (response.error) {
      console.error("Erro ao buscar detalhes do mangá:", response.message);
      return null;
    }
    const mangaCompleto = response.data;

    if (!mangaCompleto) return null;

    mangaCompleto.temporadas = [
      {
        title: mangaCompleto.title,
        episodes: mangaCompleto.chapters || 0,
        watched_episodes: 0,
      },
    ];

    return mangaCompleto;
  },

  async getDisplayDetails(localItem, lang) {
    const response = await window.electronAPI.getMediaDetails(
      "manga",
      localItem.mal_id
    );
    if (response.error) {
      console.error(
        "Erro ao buscar detalhes do mangá para exibição:",
        response.message
      );
      throw new Error("Não foi possível obter os detalhes do mangá.");
    }

    const mangaCompleto = response.data;
    if (!mangaCompleto) {
      throw new Error("Não foi possível obter os detalhes do mangá.");
    }

    mangaCompleto.synopsis = await translateText(mangaCompleto.synopsis, lang);
    return mangaCompleto;
  },
};
