import { applyTranslations } from "./views/view-helper.js";

let auth, db, currentUser, t;
let unsubscribes = []; // Array to store unsubscribe functions

// --- Funções de Lógica do Firestore ---
async function searchUsersInDB(currentUserId, username) {
  try {
    const userDoc = await db.collection("users").doc(currentUserId).get();
    const existingFriends = userDoc.exists ? userDoc.data().friends || [] : [];

    const sentRequestsSnapshot = await db
      .collection("friend_requests")
      .where("senderId", "==", currentUserId)
      .where("status", "==", "pending")
      .get();
    const pendingSentIds = sentRequestsSnapshot.docs.map(
      (doc) => doc.data().receiverId
    );

    const querySnapshot = await db
      .collection("users")
      .where("username", "==", username)
      .get();

    const users = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (
        data.uid !== currentUserId &&
        !existingFriends.includes(data.uid) &&
        !pendingSentIds.includes(data.uid)
      ) {
        users.push(data);
      }
    });
    return users;
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return [];
  }
}

function listenToFriendRequests(userId, callback) {
  const query = db
    .collection("friend_requests")
    .where("receiverId", "==", userId)
    .where("status", "==", "pending");

  const unsubscribe = query.onSnapshot(
    async (snapshot) => {
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
      // Notifica o processo principal sobre a contagem de notificações
      if (
        window.electronAPI &&
        typeof window.electronAPI.sendNotificationUpdate === "function"
      ) {
        window.electronAPI.sendNotificationUpdate(snapshot.size);
      }
    },
    (error) => {
      console.error("Erro ao ouvir pedidos de amizade:", error);
      callback([]);
    }
  );
  unsubscribes.push(unsubscribe);
}

function listenToSentRequests(userId, callback) {
  const query = db
    .collection("friend_requests")
    .where("senderId", "==", userId)
    .where("status", "==", "pending");

  const unsubscribe = query.onSnapshot(
    async (snapshot) => {
      const requests = [];
      for (const doc of snapshot.docs) {
        const request = { id: doc.id, ...doc.data() };
        const receiverDoc = await db
          .collection("users")
          .doc(request.receiverId)
          .get();
        if (receiverDoc.exists) {
          request.receiverData = receiverDoc.data();
          requests.push(request);
        }
      }
      callback(requests);
    },
    (error) => {
      console.error("Erro ao ouvir pedidos enviados:", error);
      callback([]);
    }
  );
  unsubscribes.push(unsubscribe);
}

function listenToFriends(userId, callback) {
  const unsubscribe = db
    .collection("users")
    .doc(userId)
    .onSnapshot(
      async (doc) => {
        if (!doc.exists) {
          callback([]);
          return;
        }
        const friendIds = doc.data().friends || [];
        if (friendIds.length === 0) {
          callback([]);
          return;
        }
        const friends = [];
        for (const friendId of friendIds) {
          const friendDoc = await db.collection("users").doc(friendId).get();
          if (friendDoc.exists) {
            friends.push(friendDoc.data());
          }
        }
        callback(friends);
      },
      (error) => {
        console.error("Erro ao ouvir lista de amigos:", error);
        callback([]);
      }
    );
  unsubscribes.push(unsubscribe);
}

// --- Funções de Renderização ---
function renderUserCard(user, type, requestId = null) {
  const defaultAvatar = "https://placehold.co/40x40/1f1f1f/ffffff?text=U";
  let actionsHtml = "";

  switch (type) {
    case "search":
      actionsHtml = `<button class="button-primary add-btn" data-id="${
        user.uid
      }">${t("friends.add_button")}</button>`;
      break;
    case "request":
      actionsHtml = `<button class="accept-btn" data-id="${requestId}">${t(
        "friends.accept_button"
      )}</button><button class="decline-btn" data-id="${requestId}">${t(
        "friends.decline_button"
      )}</button>`;
      break;
    case "sent":
      actionsHtml = `<button class="cancel-btn" data-id="${requestId}">${t(
        "friends.cancel_button"
      )}</button>`;
      break;
    case "friend":
      actionsHtml = `
        <button class="view-profile-btn" data-id="${user.uid}">${t(
        "friends.view_profile_button"
      )}</button>
        <button class="compare-btn" data-id="${user.uid}">${t(
        "friends.compare_button"
      )}</button>
        <button class="remove-btn" data-id="${
          user.uid
        }"><i class="fas fa-user-times"></i></button>
      `;
      break;
  }

  return `<div class="user-card">
      <img src="${user.photoURL || defaultAvatar}" alt="Avatar de ${
    user.displayName
  }">
      <div class="user-info"><strong>${user.displayName}</strong><small>@${
    user.username
  }</small></div>
      <div class="user-actions">${actionsHtml}</div>
    </div>`;
}

function renderSearchResults(users) {
  const container = document.getElementById("search-results-container");
  if (!users || users.length === 0) {
    container.innerHTML = `<p class="placeholder-text">${t(
      "friends.no_users_found"
    )}</p>`;
    return;
  }
  container.innerHTML = users
    .map((user) => renderUserCard(user, "search"))
    .join("");
}

function renderFriendRequests(requests) {
  const container = document.getElementById("friend-requests-container");
  const badge = document.getElementById("requests-count-badge");

  badge.textContent = requests.length;
  badge.classList.toggle("hidden", requests.length === 0);

  if (!requests || requests.length === 0) {
    container.innerHTML = `<p class="placeholder-text">${t(
      "friends.no_pending_requests"
    )}</p>`;
    return;
  }
  container.innerHTML = requests
    .map((req) => renderUserCard(req.senderData, "request", req.id))
    .join("");
}

function renderSentRequests(requests) {
  const container = document.getElementById("sent-requests-container");
  if (!requests || requests.length === 0) {
    container.innerHTML = `<p class="placeholder-text">${t(
      "friends.no_pending_sent_requests"
    )}</p>`;
    return;
  }
  container.innerHTML = requests
    .map((req) => renderUserCard(req.receiverData, "sent", req.id))
    .join("");
}

function renderFriendsList(friends) {
  const container = document.getElementById("friends-list-container");
  if (!friends || friends.length === 0) {
    container.innerHTML = `<p class="placeholder-text">${t(
      "friends.no_friends"
    )}</p>`;
    return;
  }
  container.innerHTML = friends
    .map((friend) => renderUserCard(friend, "friend"))
    .join("");
}

// --- Funções de Lógica ---
async function searchUsers() {
  const searchInput = document.getElementById("search-friends-input");
  const term = searchInput.value.trim();
  if (term.length < 3 || !currentUser) return;

  const results = await searchUsersInDB(currentUser.uid, term);
  renderSearchResults(results);
}

function setupRealtimeListeners() {
  if (!currentUser) return;

  unsubscribes.forEach((unsub) => unsub());
  unsubscribes = [];

  listenToFriendRequests(currentUser.uid, renderFriendRequests);
  listenToSentRequests(currentUser.uid, renderSentRequests);
  listenToFriends(currentUser.uid, renderFriendsList);
}

// --- Inicialização e Event Listeners ---
document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.firebaseInitializationPromise;
  if (!firebaseReady) return;

  auth = window.firebaseAuth;
  db = window.firebaseDb;

  const settings = await window.electronAPI.loadSettings();
  const lang = settings.language || "pt";
  t = await applyTranslations(lang);

  const btnBack = document.getElementById("btn-back");
  const minimizeBtn = document.getElementById("minimize-btn");
  const maximizeBtn = document.getElementById("maximize-btn");
  const closeBtn = document.getElementById("close-btn");
  const searchBtn = document.getElementById("search-friends-btn");
  const searchInput = document.getElementById("search-friends-input");
  const searchResultsContainer = document.getElementById(
    "search-results-container"
  );
  const tabs = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const targetTab = document.getElementById(tab.dataset.tab);
      tabContents.forEach((content) => content.classList.remove("active"));
      if (targetTab) {
        targetTab.classList.add("active");
      }
    });
  });

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      setupRealtimeListeners();
      window.electronAPI.readyToShow();
    } else {
      window.electronAPI.navigateToMain();
    }
  });

  searchBtn.addEventListener("click", searchUsers);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") searchUsers();
  });

  document.body.addEventListener("click", async (e) => {
    if (!currentUser) return;
    const actionButton = e.target.closest("button");
    if (!actionButton) return;

    const targetId = actionButton.dataset.id;

    if (actionButton.classList.contains("add-btn")) {
      await db.collection("friend_requests").add({
        senderId: currentUser.uid,
        receiverId: targetId,
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      searchInput.value = "";
      searchResultsContainer.innerHTML = "";
    } else if (actionButton.classList.contains("accept-btn")) {
      const requestRef = db.collection("friend_requests").doc(targetId);
      const requestDoc = await requestRef.get();
      if (!requestDoc.exists) return;

      const senderId = requestDoc.data().senderId;
      const receiverId = currentUser.uid;

      const batch = db.batch();
      batch.delete(requestRef);

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

      batch.update(db.collection("users").doc(receiverId), {
        friends: firebase.firestore.FieldValue.arrayUnion(senderId),
      });
      batch.update(db.collection("users").doc(senderId), {
        friends: firebase.firestore.FieldValue.arrayUnion(receiverId),
      });
      await batch.commit();
    } else if (
      actionButton.classList.contains("decline-btn") ||
      actionButton.classList.contains("cancel-btn")
    ) {
      await db.collection("friend_requests").doc(targetId).delete();
    } else if (actionButton.classList.contains("remove-btn")) {
      const batch = db.batch();
      batch.update(db.collection("users").doc(currentUser.uid), {
        friends: firebase.firestore.FieldValue.arrayRemove(targetId),
      });
      batch.update(db.collection("users").doc(targetId), {
        friends: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
      });
      await batch.commit();
    } else if (actionButton.classList.contains("view-profile-btn")) {
      window.electronAPI.navigateToUserProfile(targetId);
    } else if (actionButton.classList.contains("compare-btn")) {
      window.electronAPI.navigateToCompare(targetId);
    }
  });

  btnBack.addEventListener("click", () => window.electronAPI.navigateBack());
  minimizeBtn.addEventListener("click", () =>
    window.electronAPI.minimizeWindow()
  );
  maximizeBtn.addEventListener("click", () =>
    window.electronAPI.maximizeWindow()
  );
  closeBtn.addEventListener("click", () => window.electronAPI.closeWindow());
});
