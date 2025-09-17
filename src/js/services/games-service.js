function normalizeData(item) {
  const children = [
    {
      title: item.name,
      episodes: 1,
      watched_episodes: 0,
      release_date: item.original_release_date,
    },
  ];

  return {
    id: item.guid,
    mal_id: item.guid,
    title: item.name,
    platforms: item.platforms ? item.platforms.map((p) => p.name) : [],
    image_url: item.image ? item.image.original_url : null,
    synopsis: item.deck || "Sinopse não disponível.",
    genres: item.genres || [],
    temporadas: children,
  };
}

export const gamesService = {
  async search(term) {
    const response = await window.electronAPI.searchMedia("games", term);

    if (
      (response.error && response.error.toUpperCase() !== "OK") ||
      !response.results
    ) {
      console.error(
        "[games-service] Erro na busca:",
        response.message || response.error
      );
      return [];
    }

    const results = (response.results || []).map((r) => ({
      mal_id: r.guid,
      title: r.name,
      type: "Game",
      episodes: 1,
      images: {
        jpg: {
          image_url: r.image ? r.image.medium_url : "",
        },
      },
    }));
    return results;
  },

  async getDetails(id) {
    if (!id || id === "undefined") {
      console.error(
        "[games-service] ERRO: Tentativa de buscar detalhes com ID inválido:",
        id
      );
      return Promise.reject(new Error("ID do jogo é inválido."));
    }
    const response = await window.electronAPI.getMediaDetails("games", id);

    if (
      (response.error && response.error.toUpperCase() !== "OK") ||
      !response.results
    ) {
      console.error(
        "[games-service] Erro ao buscar detalhes do jogo:",
        response.message || response.error
      );
      return null;
    }

    const normalized = normalizeData(response.results);
    return normalized;
  },

  async getDisplayDetails(localItem) {
    if (localItem.isCustom) {
      return Promise.resolve({
        ...localItem,
        episodes: 1,
        images: { jpg: { large_image_url: localItem.image_url } },
        score: "N/A",
        type: "Game",
        status: "",
        genres: [],
      });
    }
    if (!localItem || !localItem.mal_id) {
      throw new Error(
        "Item local inválido ou sem mal_id para buscar detalhes."
      );
    }

    if (localItem.genres && localItem.genres.length > 0) {
      return Promise.resolve({ ...localItem });
    }

    const response = await window.electronAPI.getMediaDetails(
      "games",
      localItem.mal_id
    );

    if (
      (response.error && response.error.toUpperCase() !== "OK") ||
      !response.results
    ) {
      console.error(
        "[games-service] Erro ao buscar detalhes para exibição:",
        response.message
      );
      throw new Error("Não foi possível obter os detalhes do jogo.");
    }

    const gameData = response.results;

    return {
      title: gameData.name,
      synopsis: gameData.deck || "Sinopse não disponível.",
      images: {
        jpg: {
          large_image_url: gameData.image
            ? gameData.image.super_url
            : localItem.image_url,
        },
      },
      score: "N/A",
      type: "Game",
      status: gameData.original_release_date
        ? `Lançado em: ${new Date(
            gameData.original_release_date
          ).toLocaleDateString()}`
        : "",
      episodes: 1,
      genres: gameData.genres
        ? gameData.genres.map((g) => ({ name: g.name }))
        : [],
    };
  },
};
