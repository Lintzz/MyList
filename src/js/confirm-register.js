import { applyTranslations } from "./views/view-helper.js";

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.firebaseInitializationPromise;
  if (!firebaseReady) return;

  const auth = window.firebaseAuth;
  const db = window.firebaseDb;

  try {
    const settings = await window.electronAPI.loadSettings();
    const lang = settings.language || "pt";
    const t = await applyTranslations(lang);

    const profilePicPreview = document.getElementById("profile-pic-preview");
    const profilePicUrlInput = document.getElementById("profile-pic-url-input");
    const nicknameInput = document.getElementById("nickname-input");
    const usernameInput = document.getElementById("username-input");
    const saveProfileBtn = document.getElementById("save-profile-btn");
    const statusMessage = document.getElementById("status-message");
    const listSelectionContainer = document.getElementById(
      "list-selection-container"
    );
    const defaultAvatar =
      "https://placehold.co/100x100/2C2C2C/E0E0E0?text=Foto";

    const minimizeBtn = document.getElementById("minimize-btn");
    const maximizeBtn = document.getElementById("maximize-btn");
    const closeBtn = document.getElementById("close-btn");

    let currentUser = null;

    auth.onAuthStateChanged((user) => {
      if (user) {
        currentUser = user;
        profilePicPreview.src = user.photoURL || defaultAvatar;
        profilePicUrlInput.value = user.photoURL || "";
        nicknameInput.value = user.displayName || "";
        renderListSelection();
        window.electronAPI?.readyToShow();
      } else {
        window.electronAPI?.navigateToMain();
      }
    });

    profilePicUrlInput.addEventListener("input", () => {
      const newUrl = profilePicUrlInput.value.trim();
      profilePicPreview.src = newUrl || defaultAvatar;
    });

    profilePicPreview.onerror = () => {
      profilePicPreview.src = defaultAvatar;
    };

    function renderListSelection() {
      const listOrder = [
        "anime",
        "manga",
        "movies",
        "series",
        "comics",
        "books",
        "games",
      ];
      listOrder.forEach((listType) => {
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
            <input type="checkbox" checked>
            <span class="slider"></span>
          </label>
        `;
        listSelectionContainer.appendChild(item);
      });

      new Sortable(listSelectionContainer, {
        animation: 150,
        handle: ".drag-handle",
      });
    }

    saveProfileBtn.addEventListener("click", async () => {
      if (!currentUser) return;

      const newNickname = nicknameInput.value.trim();
      const newUsername = usernameInput.value.trim().toLowerCase();
      const usernameRegex = /^[a-z0-9_]{3,20}$/;

      if (!newNickname) {
        statusMessage.textContent = t("confirm_register.status_empty_nickname");
        statusMessage.classList.remove("hidden");
        return;
      }
      if (!newUsername) {
        statusMessage.textContent =
          "Por favor, insira um nome de usuário único.";
        statusMessage.classList.remove("hidden");
        return;
      }
      if (!usernameRegex.test(newUsername)) {
        statusMessage.textContent =
          "Nome de usuário inválido. Use apenas letras minúsculas, números e _, de 3 a 20 caracteres.";
        statusMessage.classList.remove("hidden");
        return;
      }

      saveProfileBtn.disabled = true;
      statusMessage.textContent = t("confirm_register.status_saving");
      statusMessage.classList.remove("hidden");

      try {
        const usersRef = db.collection("users");
        const snapshot = await usersRef
          .where("username", "==", newUsername)
          .get();
        if (!snapshot.empty) {
          statusMessage.textContent = "Este nome de usuário já está em uso.";
          saveProfileBtn.disabled = false;
          return;
        }

        const photoURL =
          profilePicUrlInput.value.trim() || currentUser.photoURL;

        const listOrder = Array.from(
          listSelectionContainer.querySelectorAll(".list-toggle")
        ).map((item) => item.dataset.listType);

        const listVisibility = {};
        listSelectionContainer
          .querySelectorAll(".list-toggle")
          .forEach((item) => {
            const listType = item.dataset.listType;
            const isVisible = item.querySelector(
              "input[type=checkbox]"
            ).checked;
            listVisibility[listType] = isVisible;
          });

        const userDocRef = db.collection("users").doc(currentUser.uid);
        await userDocRef.set(
          {
            displayName: newNickname,
            username: newUsername,
            photoURL: photoURL,
            profileComplete: true,
            settings: {
              ...settings,
              listOrder,
              listVisibility,
            },
          },
          { merge: true }
        );
        await window.electronAPI.saveSettings({
          ...settings,
          listOrder,
          listVisibility,
        });

        window.electronAPI?.navigateToHub();
      } catch (error) {
        console.error("Erro ao guardar o perfil:", error);
        statusMessage.textContent = t("confirm_register.status_error");
        saveProfileBtn.disabled = false;
      }
    });

    minimizeBtn.addEventListener("click", () =>
      window.electronAPI.minimizeWindow()
    );
    maximizeBtn.addEventListener("click", () =>
      window.electronAPI.maximizeWindow()
    );
    closeBtn.addEventListener("click", () => window.electronAPI.closeWindow());
  } catch (error) {
    console.error(
      "Falha ao inicializar a aplicação na página de registo.",
      error
    );
  }
});
