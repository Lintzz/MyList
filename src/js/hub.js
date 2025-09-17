import { carregarDadosUsuario } from "./firebase-service.js";
import { atualizarPerfilUsuario } from "./ui.js";
import { applyTranslations } from "./views/view-helper.js";
import { initHubTour } from "./tutorial.js";

let notificationListener = null;

function listenForNotifications(db, userId, callback) {
  if (notificationListener) {
    notificationListener(); // Unsubscribe from previous listener
  }

  const query = db
    .collection("friend_requests")
    .where("receiverId", "==", userId)
    .where("status", "==", "pending");

  notificationListener = query.onSnapshot(async (snapshot) => {
    const requests = [];
    for (const doc of snapshot.docs) {
      const request = { id: doc.id, ...doc.data() };
      const senderDoc = await db
        .collection("users")
        .doc(request.senderId)
        .get();
      if (senderDoc.exists) {
        request.senderData = senderDoc.data();
        requests.push(request);
      }
    }
    callback(requests);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.firebaseInitializationPromise;
  if (!firebaseReady) return;

  const auth = window.firebaseAuth;
  const db = window.firebaseDb;

  const settings = await window.electronAPI.loadSettings();
  const lang = settings.language || "pt";
  const t = await applyTranslations(lang);

  const listContainer = document.querySelector(".list-selection-container");
  const minimizeBtn = document.getElementById("minimize-btn");
  const maximizeBtn = document.getElementById("maximize-btn");
  const closeBtn = document.getElementById("close-btn");
  const userProfileArea = document.getElementById("user-profile-area");
  const userProfileDropdown = document.getElementById("user-profile-dropdown");
  const btnMyProfile = document.getElementById("btn-my-profile");
  const btnMyFriends = document.getElementById("btn-my-friends");
  const btnSettings = document.getElementById("btn-settings");
  const btnLogout = document.getElementById("btn-logout");
  const notificationBell = document.getElementById("notification-bell");
  const notificationCount = document.getElementById("notification-count");
  const notificationDropdown = document.getElementById("notification-dropdown");

  let currentUser = null;

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      const { userData } = await carregarDadosUsuario(
        db,
        currentUser.uid,
        null
      );
      if (userData) {
        atualizarPerfilUsuario(userData);
        // Passa as 'settings' para a função do tutorial
        if (!userData.hasCompletedTutorial) {
          initHubTour(db, currentUser.uid, settings, t);
        }
      }
      renderHubLists(settings, t);

      listenForNotifications(db, currentUser.uid, (requests) => {
        const count = requests.length;
        notificationBell.classList.remove("hidden");
        notificationCount.textContent = count;
        notificationCount.classList.toggle("hidden", count === 0);
        renderNotificationDropdown(requests);
      });
    } else {
      window.electronAPI.navigateToMain();
    }
  });

  notificationBell.addEventListener("click", (e) => {
    e.stopPropagation();
    abrirDropdown(notificationBell, notificationDropdown);
  });

  function renderNotificationDropdown(requests) {
    if (!notificationDropdown) return;
    notificationDropdown.innerHTML = "";
    if (requests.length === 0) {
      notificationDropdown.innerHTML = `<div class="notification-item">${t(
        "friends.no_pending_requests"
      )}</div>`;
      return;
    }

    requests.forEach((req) => {
      const item = document.createElement("div");
      item.className = "notification-item";
      item.innerHTML = `
        <img src="${
          req.senderData.photoURL ||
          "https://placehold.co/40x40/1f1f1f/ffffff?text=U"
        }" alt="Avatar">
        <div class="notification-info">
          <strong>${req.senderData.displayName}</strong>
          <span>@${req.senderData.username}</span>
        </div>
        <div class="notification-actions">
          <button class="accept-btn" data-id="${req.id}">${t(
        "friends.accept_button"
      )}</button>
          <button class="decline-btn" data-id="${req.id}">${t(
        "friends.decline_button"
      )}</button>
        </div>
      `;
      notificationDropdown.appendChild(item);
    });
  }

  if (notificationDropdown) {
    notificationDropdown.addEventListener("click", async (e) => {
      const target = e.target.closest("button");
      if (!target) return;

      const requestId = target.dataset.id;

      if (target.classList.contains("accept-btn")) {
        const requestRef = db.collection("friend_requests").doc(requestId);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) return;

        const senderId = requestDoc.data().senderId;
        const receiverId = currentUser.uid;

        const batch = db.batch();
        batch.delete(requestRef); // Deleta o pedido que foi aceite

        // Procura e deleta o pedido recíproco, se existir
        const reciprocalRequestQuery = await db
          .collection("friend_requests")
          .where("senderId", "==", receiverId)
          .where("receiverId", "==", senderId)
          .where("status", "==", "pending")
          .get();

        if (!reciprocalRequestQuery.empty) {
          const reciprocalRequestDoc = reciprocalRequestQuery.docs[0];
          batch.delete(reciprocalRequestDoc.ref);
        }

        // Adiciona ambos como amigos
        batch.update(db.collection("users").doc(receiverId), {
          friends: firebase.firestore.FieldValue.arrayUnion(senderId),
        });
        batch.update(db.collection("users").doc(senderId), {
          friends: firebase.firestore.FieldValue.arrayUnion(receiverId),
        });

        await batch.commit();
      } else if (target.classList.contains("decline-btn")) {
        // Apenas deleta o pedido
        await db.collection("friend_requests").doc(requestId).delete();
      }
    });
  }

  function renderHubLists(settings, t) {
    const listOrder = settings.listOrder || [
      "anime",
      "manga",
      "movies",
      "series",
      "comics",
      "books",
      "games",
    ];
    const listVisibility = settings.listVisibility || {};

    const listIcons = {
      anime: "fa-tv",
      manga: "fa-book-open",
      series: "fa-video",
      movies: "fa-film",
      comics: "fa-book-dead",
      books: "fa-book",
      games: "fa-gamepad",
    };

    listContainer.innerHTML = "";
    listOrder.forEach((listType) => {
      if (listVisibility[listType]) {
        const card = document.createElement("button");
        card.className = "list-card";
        card.dataset.listType = listType;
        card.innerHTML = `
          <i class="fas ${listIcons[listType]}"></i>
          <span data-i18n="hub.card_${listType}">${t(
          `hub.card_${listType}`
        )}</span>
        `;
        card.addEventListener("click", () => {
          window.electronAPI.navigateToList({ mediaType: listType });
        });
        listContainer.appendChild(card);
      }
    });
  }

  function fecharDropdowns() {
    if (userProfileDropdown) userProfileDropdown.classList.add("hidden");
    if (notificationDropdown) notificationDropdown.classList.add("hidden");
  }

  function abrirDropdown(triggerElement, menu) {
    if (!menu) return;
    const isVisible = !menu.classList.contains("hidden");

    if (!isVisible) {
      fecharDropdowns();
    }

    if (isVisible) {
      menu.classList.add("hidden");
      return;
    }

    const rect = triggerElement.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.right = "auto";

    menu.classList.remove("hidden");
  }

  userProfileArea.addEventListener("click", (e) => {
    e.stopPropagation();
    abrirDropdown(e.currentTarget, userProfileDropdown);
  });

  btnMyProfile.addEventListener("click", () => {
    window.electronAPI.navigateToProfile();
  });
  btnMyFriends.addEventListener("click", () => {
    window.electronAPI.navigateToFriends();
  });
  btnSettings.addEventListener("click", () =>
    window.electronAPI.navigateToSettings()
  );
  btnLogout.addEventListener("click", () => window.electronAPI.logout());

  window.addEventListener("click", fecharDropdowns);

  minimizeBtn.addEventListener("click", () =>
    window.electronAPI.minimizeWindow()
  );
  maximizeBtn.addEventListener("click", () =>
    window.electronAPI.maximizeWindow()
  );
  closeBtn.addEventListener("click", () => window.electronAPI.closeWindow());

  window.electronAPI.readyToShow();
});
