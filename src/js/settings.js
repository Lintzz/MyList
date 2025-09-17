import { applyAppearance } from "./appearance.js";
import { applyTranslations } from "./views/view-helper.js";

let auth, db;

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.firebaseInitializationPromise;
  if (!firebaseReady) return;

  auth = window.firebaseAuth;
  db = window.firebaseDb;
  const GoogleAuthProvider = firebase.auth.GoogleAuthProvider;

  try {
    const settings = await window.electronAPI.loadSettings();
    const lang = settings.language || "pt";
    const t = await applyTranslations(lang);

    let currentUser = null;
    let currentSettings = {};
    let confirmCallback = null;
    let isReauthenticatingForDelete = false;

    const sidebarLinks = document.querySelectorAll(
      ".settings-sidebar .nav-link"
    );
    const tabContents = document.querySelectorAll(
      ".settings-content .tab-content"
    );
    const btnBack = document.getElementById("btn-back");
    const themeSelector = document.getElementById("theme-selector");
    const accentColorSelector = document.getElementById(
      "accent-color-selector"
    );
    const listDensitySelector = document.getElementById(
      "list-density-selector"
    );
    const languageSelector = document.getElementById("language-selector");
    const btnDeleteLists = document.getElementById("btn-delete-lists");
    const btnDeleteAccount = document.getElementById("btn-delete-account");
    const btnImport = document.getElementById("btn-import");
    const btnExport = document.getElementById("btn-export");
    const btnGithub = document.getElementById("btn-github");
    const btnChangelog = document.getElementById("btn-changelog");
    const modalOverlay = document.getElementById("modal-overlay");
    const modalTitle = document.getElementById("modal-title");
    const modalMessage = document.getElementById("modal-message");
    const modalBtnConfirm = document.getElementById("modal-btn-confirm");
    const modalBtnCancel = document.getElementById("modal-btn-cancel");
    const minimizeBtn = document.getElementById("minimize-btn");
    const maximizeBtn = document.getElementById("maximize-btn");
    const closeBtn = document.getElementById("close-btn");
    const listManagementContainer = document.getElementById(
      "list-management-container"
    );
    const btnResetTutorial = document.getElementById("btn-reset-tutorial");

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        await loadAndApplySettings();
        setupEventListeners();
      } else {
        window.electronAPI.navigateToMain();
      }
    });

    async function loadAndApplySettings() {
      try {
        if (window.electronAPI) {
          currentSettings = await window.electronAPI.loadSettings();
        }
      } catch (error) {
        console.error("Falha ao carregar as configurações:", error);
        currentSettings = {
          theme: "theme-dark",
          accentColor: "blue",
          language: "pt",
          listDensity: "compact",
          listOrder: [
            "anime",
            "manga",
            "movies",
            "series",
            "comics",
            "books",
            "games",
          ],
          listVisibility: {
            anime: true,
            manga: true,
            movies: true,
            series: true,
            comics: true,
            books: true,
            games: true,
          },
        };
      } finally {
        applyAppearance(currentSettings);
        themeSelector.value = currentSettings.theme || "theme-dark";
        accentColorSelector.value = currentSettings.accentColor || "blue";
        listDensitySelector.value = currentSettings.listDensity || "compact";
        languageSelector.value = currentSettings.language || "pt";
        renderListManagement();
        window.electronAPI?.readyToShow();
      }
    }

    function showModal(title, message, onConfirm = null) {
      modalTitle.textContent = title;
      modalMessage.innerHTML = message;
      confirmCallback = onConfirm;

      if (onConfirm) {
        modalBtnConfirm.style.display = "inline-block";
        modalBtnCancel.style.display = "inline-block";
        modalBtnConfirm.textContent = t("app.modal_confirm");
        modalBtnConfirm.classList.add("destructive");
      } else {
        modalBtnConfirm.style.display = "inline-block";
        modalBtnCancel.style.display = "none";
        modalBtnConfirm.textContent = "OK";
        modalBtnConfirm.classList.remove("destructive");
      }

      modalOverlay.classList.remove("hidden");
      setTimeout(() => modalOverlay.classList.add("visible"), 10);
    }

    function hideModal() {
      modalOverlay.classList.remove("visible");
      setTimeout(() => {
        modalOverlay.classList.add("hidden");
        if (typeof confirmCallback === "function") {
          confirmCallback();
        }
        confirmCallback = null;
      }, 200);
    }

    modalBtnConfirm.addEventListener("click", () => {
      if (typeof confirmCallback === "function") {
        confirmCallback();
      }
      hideModal();
    });

    function handleDeleteAllLists() {
      showModal(
        t("settings.modal_delete_list_title"),
        t("settings.modal_delete_list_message"),
        async () => {
          if (!currentUser) return;
          const userDocRef = db.collection("users").doc(currentUser.uid);
          await userDocRef.set({ lists: {} }, { merge: true });
          showModal(
            t("settings.modal_delete_list_success_title"),
            t("settings.modal_delete_list_success_message")
          );
        }
      );
    }

    async function handleExportJson() {
      if (!currentUser) return;
      const userDocRef = db.collection("users").doc(currentUser.uid);
      const docSnap = await userDocRef.get();
      if (docSnap.exists && docSnap.data().lists) {
        const allLists = docSnap.data().lists;
        const result = await window.electronAPI.exportarJson(allLists);
        if (result && result.success) {
          showModal(
            t("settings.modal_export_success_title"),
            t("settings.modal_export_success_message")
          );
        }
      }
    }

    async function handleImportJson() {
      if (!currentUser) return;
      const importedData = await window.electronAPI.importarJson();
      if (
        importedData &&
        typeof importedData === "object" &&
        Object.keys(importedData).length > 0
      ) {
        showModal(
          t("settings.modal_import_title"),
          t("settings.modal_import_message"),
          async () => {
            const userDocRef = db.collection("users").doc(currentUser.uid);
            await userDocRef.set({ lists: importedData }, { merge: true });
            showModal(
              t("settings.modal_import_success_title"),
              t("settings.modal_import_success_message")
            );
          }
        );
      }
    }

    function handleDeleteAccount() {
      showModal(
        t("settings.modal_delete_account_title"),
        t("settings.modal_delete_account_message"),
        () => {
          if (!currentUser) return;

          showModal(
            t("settings.alert_reauth_title"),
            t("settings.alert_reauth_message"),
            () => {
              isReauthenticatingForDelete = true;
              window.electronAPI.openExternalLink(
                "https://minha-lista-ponte.vercel.app"
              );
            }
          );
        }
      );
    }

    function renderListManagement() {
      const listOrder = currentSettings.listOrder || [
        "anime",
        "manga",
        "movies",
        "series",
        "comics",
        "books",
        "games",
      ];
      const listVisibility = currentSettings.listVisibility || {
        anime: true,
        manga: true,
        movies: true,
        series: true,
        comics: true,
        books: true,
        games: true,
      };

      listManagementContainer.innerHTML = "";
      const listElement = document.createElement("div");
      listElement.className = "list-management";
      listOrder.forEach((listType) => {
        const isVisible =
          listVisibility[listType] !== undefined
            ? listVisibility[listType]
            : true;
        const item = document.createElement("div");
        item.className = "list-toggle";
        item.dataset.listType = listType;
        item.innerHTML = `
          <div>
            <i class="fas fa-grip-vertical drag-handle"></i>
            <span data-i18n="hub.card_${listType}">${t(
          `hub.card_${listType}`
        )}</span>
          </div>
          <label class="switch">
            <input type="checkbox" ${isVisible ? "checked" : ""}>
            <span class="slider"></span>
          </label>
        `;
        listElement.appendChild(item);
      });
      listManagementContainer.appendChild(listElement);

      new Sortable(listElement, {
        animation: 150,
        handle: ".drag-handle",
        onEnd: async () => {
          const newListOrder = Array.from(
            listElement.querySelectorAll(".list-toggle")
          ).map((item) => item.dataset.listType);
          currentSettings.listOrder = newListOrder;
          await window.electronAPI.saveSettings(currentSettings);
        },
      });
    }

    async function handleVisibilityChange(event) {
      if (event.target.type === "checkbox") {
        const listType = event.target.closest(".list-toggle").dataset.listType;
        if (!currentSettings.listVisibility) {
          currentSettings.listVisibility = {};
        }
        currentSettings.listVisibility[listType] = event.target.checked;
        await window.electronAPI.saveSettings(currentSettings);
      }
    }

    function setupEventListeners() {
      sidebarLinks.forEach((link) => {
        link.addEventListener("click", (e) => {
          e.preventDefault();
          const tab = link.dataset.tab;
          sidebarLinks.forEach((l) => l.classList.remove("active"));
          link.classList.add("active");
          tabContents.forEach((content) => {
            content.classList.toggle("active", content.id === tab);
          });
        });
      });

      btnBack.addEventListener("click", () =>
        window.electronAPI?.navigateBack()
      );
      minimizeBtn.addEventListener("click", () =>
        window.electronAPI?.minimizeWindow()
      );
      maximizeBtn.addEventListener("click", () =>
        window.electronAPI?.maximizeWindow()
      );
      closeBtn.addEventListener("click", () =>
        window.electronAPI?.closeWindow()
      );

      themeSelector.addEventListener("change", async (e) => {
        currentSettings.theme = e.target.value;
        applyAppearance(currentSettings);
        await window.electronAPI?.saveSettings(currentSettings);
      });

      accentColorSelector.addEventListener("change", async (e) => {
        currentSettings.accentColor = e.target.value;
        applyAppearance(currentSettings);
        await window.electronAPI?.saveSettings(currentSettings);
      });

      listDensitySelector.addEventListener("change", async (e) => {
        currentSettings.listDensity = e.target.value;
        applyAppearance(currentSettings);
        await window.electronAPI?.saveSettings(currentSettings);
      });

      languageSelector.addEventListener("change", async (e) => {
        currentSettings.language = e.target.value;
        await window.electronAPI?.saveSettings(currentSettings);
        showModal(
          t("settings.alert_lang_change_title"),
          t("settings.alert_lang_change_message"),
          () => {
            location.reload();
          }
        );
      });

      btnDeleteLists.addEventListener("click", handleDeleteAllLists);
      btnDeleteAccount.addEventListener("click", handleDeleteAccount);
      btnImport.addEventListener("click", handleImportJson);
      btnExport.addEventListener("click", handleExportJson);
      btnGithub.addEventListener("click", () =>
        window.electronAPI.openExternalLink("https://github.com/Lintzz")
      );
      btnChangelog.addEventListener("click", () => {
        window.electronAPI.navigateToChangelog();
      });

      if (btnResetTutorial) {
        btnResetTutorial.addEventListener("click", async () => {
          if (!currentUser) return;
          try {
            await db.collection("users").doc(currentUser.uid).update({
              hasCompletedTutorial: false,
            });
            showModal(
              t("settings.reset_tutorial_success_title"),
              t("settings.reset_tutorial_success_message")
            );
          } catch (error) {
            console.error("Erro ao resetar o tutorial:", error);
            showModal(
              t("settings.reset_tutorial_error_title"),
              t("settings.reset_tutorial_error_message")
            );
          }
        });
      }

      modalBtnCancel.addEventListener("click", hideModal);

      modalOverlay.addEventListener("click", (e) => {
        if (e.target === modalOverlay) {
          hideModal();
        }
      });

      listManagementContainer.addEventListener(
        "change",
        handleVisibilityChange
      );

      window.electronAPI.handleDeepLink(async (url) => {
        if (!isReauthenticatingForDelete || !currentUser) return;
        isReauthenticatingForDelete = false;

        try {
          const urlParams = new URLSearchParams(new URL(url).search);
          const idToken = urlParams.get("idToken");
          if (!idToken) throw new Error("Token não encontrado.");

          const credential = GoogleAuthProvider.credential(idToken);
          await currentUser.reauthenticateWithCredential(credential);

          const userDocRef = db.collection("users").doc(currentUser.uid);
          await userDocRef.delete();
          await currentUser.delete();
        } catch (error) {
          console.error("Erro ao reautenticar e apagar conta:", error);
        }
      });
    }
  } catch (error) {
    console.error(
      "Falha ao inicializar a aplicação na página de registo.",
      error
    );
  }
});
