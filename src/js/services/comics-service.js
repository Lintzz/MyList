function cleanSynopsis(description) {
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

function normalizeData(volumeData) {
  const issues = (volumeData.issues || []).map((issue) => ({
    title: `${issue.name || "Edição"} #${issue.issue_number}`,
    episodes: 1,
    watched_episodes: 0,
  }));

  issues.sort((a, b) => {
    const numA = parseInt(a.title.match(/#(\d+)/)?.[1] || 0);
    const numB = parseInt(b.title.match(/#(\d+)/)?.[1] || 0);
    return numA - numB;
  });

  const title = `${volumeData.name} (${volumeData.start_year || "N/A"})`;

  const normalized = {
    id: volumeData.id,
    mal_id: volumeData.id,
    title: title,
    publisherName: volumeData.publisher?.name || "Editora Desconhecida",
    volumeName: volumeData.name || "Volume Desconhecido",
    authors: [],
    image_url: volumeData.image?.original_url || null,
    synopsis: cleanSynopsis(volumeData.description),
    temporadas: issues,
  };

  return normalized;
}

export const comicsService = {
  async search(term) {
    const response = await window.electronAPI.searchMedia("comics", term);

    if (
      (response.error && response.error !== "OK") ||
      !Array.isArray(response.results)
    ) {
      console.error(
        "Erro ao buscar volumes de HQs:",
        response.message || "Resposta inválida da API"
      );
      return [];
    }

    return response.results.map((volume) => ({
      mal_id: volume.id,
      title: `${volume.name} (${volume.start_year || "N/A"})`,
      type: "HQ (Volume)",
      volumeName: volume.publisher?.name || "Editora desconhecida",
      episodes: "...",
      images: {
        jpg: {
          image_url: volume.image?.medium_url || "",
        },
      },
    }));
  },

  async getDetails(id) {
    const response = await window.electronAPI.getMediaDetails("comics", id);

    if ((response.error && response.error !== "OK") || !response.results) {
      console.error("Erro ao buscar detalhes do volume:", response.message);
      return null;
    }

    return normalizeData(response.results);
  },

  async getDisplayDetails(localItem) {
    if (localItem.isCustom) {
      return Promise.resolve({
        ...localItem,
        episodes: localItem.temporadas.reduce(
          (acc, s) => acc + (s.episodes || 0),
          0
        ),
        images: { jpg: { large_image_url: localItem.image_url } },
        score: "N/A",
        type: "HQ (Volume)",
        status: localItem.publisherName || "",
        genres: [],
      });
    }
    const response = await window.electronAPI.getMediaDetails(
      "comics",
      localItem.mal_id
    );

    if ((response.error && response.error !== "OK") || !response.results) {
      throw new Error("Não foi possível obter os detalhes do volume da HQ.");
    }

    const item = response.results;

    const displayData = {
      title: `${item.name} (${item.start_year || "N/A"})`,
      authors: [],
      synopsis: cleanSynopsis(item.description),
      images: {
        jpg: {
          large_image_url: item.image?.original_url || localItem.image_url,
        },
      },
      score: "N/A",
      type: "HQ (Volume)",
      status: item.publisher?.name || "",
      episodes: (item.issues || []).length,
      genres: [],
    };

    return displayData;
  },
};
