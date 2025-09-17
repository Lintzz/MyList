// src/js/tutorial.js
import Shepherd from "../../node_modules/shepherd.js/dist/esm/shepherd.mjs";

let tour;

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
export function initHubTour(db, userId, t) {
  tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: "shepherd-theme-arrows",
      cancelIcon: {
        enabled: true,
        label: "Fechar",
      },
      scrollTo: { behavior: "smooth", block: "center" },
    },
  });

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
    text: t("tutorial.hub_step3_text"),
    attachTo: { element: '.list-card[data-list-type="anime"]', on: "bottom" },
    buttons: [],
    when: {
      show: () => {
        sessionStorage.setItem("startListTour", "true");
      },
    },
    advanceOn: {
      selector: '.list-card[data-list-type="anime"]',
      event: "click",
    },
  });

  tour.on("cancel", () => completeTutorial(db, userId));

  tour.start();
}

// Inicia a Parte 2 do tour (na tela da lista)
export function initListTour(db, userId, t) {
  tour = new Shepherd.Tour({
    useModalOverlay: true,
    defaultStepOptions: {
      classes: "shepherd-theme-arrows",
      cancelIcon: {
        enabled: true,
        label: "Fechar",
      },
      scrollTo: { behavior: "smooth", block: "center" },
    },
  });

  tour.addStep({
    title: t("tutorial.list_step1_title"),
    text: t("tutorial.list_step1_text"),
    attachTo: { element: "#user-profile-area", on: "bottom" },
    advanceOn: { selector: "#user-profile-area", event: "click" },
    buttons: [],
  });

  tour.addStep({
    title: t("tutorial.list_step1_5_title"),
    text: t("tutorial.list_step1_5_text"),
    attachTo: { element: "#user-profile-dropdown", on: "right-start" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    title: t("tutorial.list_step2_title"),
    text: t("tutorial.list_step2_text"),
    attachTo: { element: "#mostrarFormBtn", on: "right" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    title: t("tutorial.list_step2_5_title"),
    text: t("tutorial.list_step2_5_text"),
    attachTo: { element: "#add-custom-item-btn", on: "right" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    title: t("tutorial.list_step3_title"),
    text: t("tutorial.list_step3_text"),
    attachTo: { element: ".top-nav", on: "bottom" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    title: t("tutorial.list_step4_title"),
    text: t("tutorial.list_step4_text"),
    attachTo: { element: ".action-buttons", on: "left" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    title: t("tutorial.list_step5_title"),
    text: t("tutorial.list_step5_text"),
    attachTo: { element: ".cabecalho-lista", on: "bottom" },
    buttons: [{ text: t("tutorial.next_button"), action: tour.next }],
  });

  tour.addStep({
    title: t("tutorial.list_step6_title"),
    text: t("tutorial.list_step6_text"),
    buttons: [
      {
        text: t("tutorial.finish_button"),
        action: () => completeTutorial(db, userId),
      },
    ],
  });

  tour.on("cancel", () => completeTutorial(db, userId));
  tour.on("complete", () => completeTutorial(db, userId));

  tour.start();
}
