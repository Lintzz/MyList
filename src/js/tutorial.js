// src/js/tutorial.js
import Shepherd from "../../node_modules/shepherd.js/dist/esm/shepherd.mjs";

let tour;

// Mapeamento de termos de pesquisa para cada tipo de mídia
const searchTerms = {
  anime: "Naruto",
  manga: "One Piece",
  movies: "The Matrix",
  series: "Breaking Bad",
  comics: "Batman",
  books: "Emma",
  games: "The Witcher",
};

// Função para marcar o tutorial como concluído no Firestore e finalizar o tour
async function completeTutorial(db, userId) {
  if (userId) {
    try {
      await db
        .collection("users")
        .doc(userId)
        .update({ hasCompletedTutorial: true });
    } catch (error) {
      console.error("Erro ao marcar o tutorial como concluído:", error);
    }
  }
  if (tour) tour.complete();
}

// Inicia a Parte 1 do tour (no Hub)
export function initHubTour(db, userId, settings, t) {
  tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: "shepherd-theme-arrows",
      canClickTarget: false,
      cancelIcon: {
        enabled: true,
        label: "Fechar",
      },
      scrollTo: { behavior: "smooth", block: "center" },
    },
  });

  // Encontra a primeira lista visível para usar como base do tutorial
  const firstVisibleList = settings.listOrder.find(
    (listType) => settings.listVisibility[listType]
  );

  if (!firstVisibleList) {
    console.warn("Nenhuma lista visível encontrada para iniciar o tutorial.");
    completeTutorial(db, userId);
    return;
  }

  const listCardSelector = `.list-card[data-list-type="${firstVisibleList}"]`;
  const listCardName = t(`hub.card_${firstVisibleList}`);

  tour.addStep({
    title: t("tutorial.hub_step1_title"),
    text: t("tutorial.hub_step1_text"),
    buttons: [
      {
        text: t("tutorial.skip_button"),
        action: () => completeTutorial(db, userId),
        secondary: true,
      },
      {
        text: t("tutorial.start_button"),
        action: tour.next,
      },
    ],
  });

  tour.addStep({
    title: t("tutorial.hub_step2_title"),
    text: t("tutorial.hub_step2_text"),
    attachTo: { element: ".list-selection-container", on: "bottom" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    title: t("tutorial.hub_step3_title"),
    text: t("tutorial.hub_step3_text", { listName: listCardName }),
    attachTo: { element: listCardSelector, on: "bottom" },
    canClickTarget: true,
    buttons: [],
    when: {
      show: () => {
        sessionStorage.setItem("startListTour", "true");
        sessionStorage.setItem("tutorialMediaType", firstVisibleList);
      },
    },
    advanceOn: {
      selector: listCardSelector,
      event: "click",
    },
  });

  tour.on("cancel", () => completeTutorial(db, userId));

  tour.start();
}

// Inicia a Parte 2 do tour (na tela da lista)
export function initListTour(db, userId, t) {
  const mediaType = sessionStorage.getItem("tutorialMediaType");
  if (!mediaType) return;

  const isBooksOrGames = mediaType === "books" || mediaType === "games";
  const searchTerm = searchTerms[mediaType] || "MyList";

  tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: "shepherd-theme-arrows",
      canClickTarget: false,
      cancelIcon: {
        enabled: true,
        label: "Fechar",
      },
      scrollTo: { behavior: "smooth", block: "center" },
    },
  });

  tour.addStep({
    id: "list-step1",
    title: t("tutorial.list_step1_title"),
    text: t("tutorial.list_step1_text"),
    attachTo: { element: "#user-profile-area", on: "bottom" },
    canClickTarget: true,
    advanceOn: { selector: "#user-profile-area", event: "click" },
    buttons: [],
  });

  tour.addStep({
    id: "list-step1_5",
    title: t("tutorial.list_step1_5_title"),
    text: t("tutorial.list_step1_5_text"),
    attachTo: { element: "#user-profile-dropdown", on: "right-start" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    id: "list-step2",
    title: t("tutorial.list_step2_title"),
    text: t("tutorial.list_step2_text"),
    attachTo: { element: "#mostrarFormBtn", on: "right" },
    canClickTarget: true,
    advanceOn: { selector: "#mostrarFormBtn", event: "click" },
  });

  tour.addStep({
    id: "list-step3",
    title: t("tutorial.list_step3_title"),
    text: t("tutorial.list_step3_text", { searchTerm }),
    attachTo: { element: "#content-frame", on: "top" },
    buttons: [
      {
        text: t("tutorial.next_button"),
        action: function () {
          const contentFrame = document.getElementById("content-frame");
          contentFrame.contentWindow.postMessage(
            { type: "tutorial-search", payload: { term: searchTerm } },
            "*"
          );
        },
      },
    ],
  });

  tour.addStep({
    id: "list-step4",
    title: t("tutorial.list_step4_5_title"),
    text: t("tutorial.list_step4_5_text"),
    attachTo: { element: "#content-frame", on: "top" },
    canClickTarget: true,
    buttons: [],
  });

  tour.addStep({
    id: "list-step4_6",
    title: t("tutorial.list_step4_6_title"),
    text: t("tutorial.list_step4_6_text"),
    attachTo: { element: "#content-frame", on: "top" },
    buttons: [
      {
        text: t("tutorial.continue_button"),
        action: function () {
          const contentFrame = document.getElementById("content-frame");
          contentFrame.contentWindow.postMessage(
            { type: "tutorial-close-details" },
            "*"
          );
        },
      },
    ],
  });

  tour.addStep({
    id: "list-step4_7",
    title: t("tutorial.list_step4_title"),
    text: t("tutorial.list_step4_text"),
    attachTo: { element: "#content-frame", on: "top" },
    canClickTarget: true,
    buttons: [],
  });

  if (isBooksOrGames) {
    // Fluxo para Livros e Games
    tour.addStep({
      id: "list-step5-books-games",
      title: t("tutorial.list_step5_books_games_title"),
      text: t("tutorial.list_step5_books_games_text"),
      attachTo: { element: "#status-modal-overlay", on: "top" },
      buttons: [
        {
          text: t("tutorial.next_button"),
          action: function () {
            // Simula o clique no primeiro botão de status
            document
              .querySelector("#status-modal-options .status-option-btn")
              .click();
          },
        },
      ],
    });
  } else {
    // Fluxo para as outras mídias
    tour.addStep({
      id: "list-step5",
      title: t("tutorial.list_step5_title"),
      text: t("tutorial.list_step5_text"),
      attachTo: { element: "#season-selection-view", on: "top" },
      buttons: [
        {
          text: t("tutorial.next_button"),
          action: function () {
            document.getElementById("add-selected-seasons-btn").click();
          },
        },
      ],
    });
  }

  tour.addStep({
    id: "list-step6",
    title: t("tutorial.list_step6_title"),
    text: t("tutorial.list_step6_text"),
    attachTo: { element: "#minhaLista .anime-entry:first-child", on: "bottom" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    id: "list-step6_1",
    title: t("tutorial.list_step6_1_title"),
    text: t("tutorial.list_step6_1_text"),
    attachTo: { element: "#add-custom-item-btn", on: "right" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    id: "list-step6_2",
    title: t("tutorial.list_step6_2_title"),
    text: t("tutorial.list_step6_2_text"),
    attachTo: { element: ".action-buttons", on: "left" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    id: "list-step6_5",
    title: t("tutorial.list_step6_5_title"),
    text: t("tutorial.list_step6_5_text"),
    attachTo: {
      element: "#minhaLista .anime-entry:first-child .anime-title-link",
      on: "bottom",
    },
    canClickTarget: true,
    advanceOn: {
      selector: "#minhaLista .anime-entry:first-child .anime-title-link",
      event: "click",
    },
  });

  tour.addStep({
    id: "list-step6_6",
    title: t("tutorial.list_step6_6_title"),
    text: t("tutorial.list_step6_6_text"),
    attachTo: { element: "#details-modal-overlay", on: "top" },
    buttons: [
      {
        text: t("tutorial.continue_button"),
        action: function () {
          document.getElementById("details-modal-close-btn").click();
          tour.next();
        },
      },
    ],
  });

  tour.addStep({
    id: "list-step7",
    title: t("tutorial.list_step7_title"),
    text: t("tutorial.list_step7_text"),
    attachTo: {
      element: "#minhaLista .anime-entry:first-child .options-btn",
      on: "left",
    },
    canClickTarget: true,
    advanceOn: {
      selector: "#minhaLista .anime-entry:first-child .options-btn",
      event: "click",
    },
  });

  tour.addStep({
    id: "list-step8",
    title: t("tutorial.list_step8_title"),
    text: t("tutorial.list_step8_text"),
    attachTo: { element: "#btn-dropdown-edit", on: "left" },
    canClickTarget: true,
    advanceOn: { selector: "#btn-dropdown-edit", event: "click" },
  });

  if (!isBooksOrGames) {
    tour.addStep({
      id: "list-step8_5",
      title: t("tutorial.list_step8_5_title"),
      text: t("tutorial.list_step8_5_text"),
      attachTo: { element: "#check-new-seasons-btn", on: "bottom" },
      buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
    });
  }

  const finalStepText = isBooksOrGames
    ? t("tutorial.list_step9_text_books_games")
    : t("tutorial.list_step9_text");

  tour.addStep({
    id: "list-step9",
    title: t("tutorial.list_step9_title"),
    text: finalStepText,
    attachTo: { element: "#edit-modal-overlay", on: "top" },
    buttons: [
      {
        text: t("tutorial.finish_button"),
        action: () => {
          document.getElementById("edit-modal-save-btn").click();
          completeTutorial(db, userId);
        },
      },
    ],
  });

  tour.on("cancel", () => completeTutorial(db, userId));
  tour.on("complete", () => completeTutorial(db, userId));

  window.startListTour = () => tour.start();
  window.tour = tour;
}
