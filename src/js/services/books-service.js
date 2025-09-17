function normalizeData(item) {
  const synopsis = item.description
    ? typeof item.description === "string"
      ? item.description
      : item.description.value
    : "Sinopse não disponível.";

  const children = [
    {
      title: item.title,
      episodes: 1,
      watched_episodes: 0,
    },
  ];

  // Extract and clean subjects as genres
  const genres = (item.subjects || [])
    .filter(
      (s) =>
        s.length < 30 &&
        !s.includes("(Fictitious character)") &&
        !s.includes("--")
    )
    .slice(0, 10)
    .map((s) => ({ name: s })); // Make it an array of objects to be consistent

  return {
    id: item.key,
    mal_id: item.key,
    title: item.title,
    authors: item.authors ? item.authors.map((a) => a.name) : [],
    image_url: item.covers
      ? `https://covers.openlibrary.org/b/id/${item.covers[0]}-L.jpg`
      : null,
    synopsis: synopsis,
    temporadas: children,
    genres: genres, // Add genres here
  };
}

export const booksService = {
  async search(term) {
    const response = await window.electronAPI.searchMedia("books", term);
    if (response.error) {
      console.error("Erro ao buscar livros:", response.message);
      return [];
    }

    return (response.docs || []).map((r) => ({
      mal_id: r.key,
      title: r.title,
      authors: (r.author_name || []).map((name) => ({ name })),
      type: "Livro",
      episodes: 1,
      images: {
        jpg: {
          image_url: r.cover_i
            ? `https://covers.openlibrary.org/b/id/${r.cover_i}-M.jpg`
            : "",
        },
      },
    }));
  },

  async getDetails(id) {
    const response = await window.electronAPI.getMediaDetails("books", id);
    if (response.error) {
      console.error("Erro ao buscar detalhes do livro:", response.message);
      return null;
    }

    if (response.authors) {
      const authorKey = response.authors[0].author.key;
      const authorResponse = await fetch(
        `https://openlibrary.org${authorKey}.json`
      );
      const authorData = await authorResponse.json();
      response.authors = [{ name: authorData.name }];
    }

    return normalizeData(response);
  },

  async getDisplayDetails(localItem, lang) {
    if (localItem.isCustom) {
      return Promise.resolve({
        ...localItem,
        episodes: 1,
        images: { jpg: { large_image_url: localItem.image_url } },
        score: "N/A",
        type: "Livro",
        status: "",
        genres: [],
      });
    }
    const response = await this.getDetails(localItem.mal_id);
    if (!response) {
      throw new Error("Não foi possível obter os detalhes do livro.");
    }

    return {
      title: response.title,
      authors: response.authors || [],
      synopsis: response.synopsis || "Sinopse não disponível.",
      images: { jpg: { large_image_url: response.image_url } },
      score: "N/A",
      type: "Livro",
      status: "",
      episodes: 1,
      genres: response.genres || [], // Pass genres here
    };
  },
};
