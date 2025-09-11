function normalizeData(item) {
  const children = item.seasons
    ? item.seasons.map((season) => ({
        title: season.name,
        episodes: season.episode_count,
        watched_episodes: 0,
        release_date: season.air_date,
      }))
    : [];

  return {
    id: item.id,
    mal_id: item.id,
    title: item.name,
    image_url: item.poster_path
      ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
      : null,
    synopsis: item.overview,
    temporadas: children,
  };
}

export const seriesService = {
  async search(term) {
    const response = await window.electronAPI.searchMedia("series", term);
    if (response.error) {
      console.error("Erro ao buscar séries:", response.message);
      return [];
    }

    return (response.results || []).map((r) => ({
      mal_id: r.id,
      title: r.name,
      type: "Série",
      episodes: r.number_of_episodes || "N/A",
      images: {
        jpg: {
          image_url: r.poster_path
            ? `https://image.tmdb.org/t/p/w200${r.poster_path}`
            : "",
        },
      },
    }));
  },

  async getDetails(id) {
    const response = await window.electronAPI.getMediaDetails("series", id);
    if (response.error) {
      console.error("Erro ao buscar detalhes da série:", response.message);
      return null;
    }
    return normalizeData(response);
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
        type: "Série",
        status: "",
        genres: [],
      });
    }
    return Promise.resolve({
      title: localItem.title,
      synopsis: localItem.synopsis || "Sinopse não disponível.",
      images: { jpg: { large_image_url: localItem.image_url } },
      score: "N/A",
      type: "Série",
      status: "",
      episodes: localItem.temporadas.reduce(
        (acc, s) => acc + (s.episodes || 0),
        0
      ),
      genres: [],
    });
  },
};
