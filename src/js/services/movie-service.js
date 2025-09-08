function normalizeData(item) {
  const isCollection = !!item.parts;

  const children = isCollection
    ? item.parts.map((movie) => ({
        title: movie.title,
        episodes: 1,
        watched_episodes: 0,
        release_date: movie.release_date,
      }))
    : [
        {
          title: item.title,
          episodes: 1,
          watched_episodes: 0,
          release_date: item.release_date,
        },
      ];

  children.sort((a, b) => new Date(a.release_date) - new Date(b.release_date));

  return {
    id: item.id,
    mal_id: item.id,
    title: item.name || item.title,
    itemType: isCollection ? "collection" : "movie",
    image_url:
      item.poster_path || item.backdrop_path
        ? `https://image.tmdb.org/t/p/w500${
            item.poster_path || item.backdrop_path
          }`
        : null,
    synopsis: item.overview,
    temporadas: children,
  };
}

export const movieService = {
  async search(term) {
    const response = await window.electronAPI.searchMedia("movies", term);
    if (response.error) {
      console.error("Erro ao buscar filmes/coleções:", response.message);
      return [];
    }

    return (response.results || [])
      .filter((r) => r.media_type === "movie" || r.media_type === "collection")
      .map((r) => ({
        mal_id: r.id,
        title: r.title || r.name,
        type: r.media_type,
        episodes: r.media_type === "collection" ? "Vários" : 1,
        images: {
          jpg: {
            image_url: r.poster_path
              ? `https://image.tmdb.org/t/p/w200${r.poster_path}`
              : "",
          },
        },
      }));
  },

  async getDetails(id, searchResults, itemType) {
    let finalItemType = itemType || "movie";

    const details = await window.electronAPI.getMediaDetails(finalItemType, id);

    if (details.error) {
      if (finalItemType === "movie") {
        const collectionDetails = await window.electronAPI.getMediaDetails(
          "collection",
          id
        );
        if (!collectionDetails.error) return normalizeData(collectionDetails);
      }
      console.error(
        `Erro ao buscar detalhes de ${finalItemType}:`,
        details.message
      );
      return null;
    }

    if (finalItemType === "movie" && details.belongs_to_collection) {
      const collectionId = details.belongs_to_collection.id;
      const collectionDetails = await window.electronAPI.getMediaDetails(
        "collection",
        collectionId
      );

      if (collectionDetails.error) {
        return normalizeData(details);
      }
      return normalizeData(collectionDetails);
    }

    return normalizeData(details);
  },

  async getDisplayDetails(localItem) {
    return Promise.resolve({
      title: localItem.title,
      synopsis: localItem.synopsis || "Sinopse não disponível.",
      images: { jpg: { large_image_url: localItem.image_url } },
      score: "N/A",
      type: "Filme/Coleção",
      status: "",
      episodes: localItem.temporadas.length,
      genres: [],
    });
  },
};
