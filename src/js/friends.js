let auth, db, currentUser, t;

async function applyTranslations(lang) {
  const response = await fetch(`../locales/${lang}.json`);
  const translations = await response.json();
  const translateFn = (key) =>
    key.split(".").reduce((obj, i) => obj?.[i], translations) || key;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (key.startsWith("[") && key.includes("]")) {
      const match = key.match(/\[(.*?)\](.*)/);
      if (match) {
        const attr = match[1];
        const actualKey = match[2];
        element.setAttribute(attr, translateFn(actualKey));
      }
    } else {
      element.innerHTML = translateFn(key);
    }
  });

  return translateFn;
}

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

async function getFriendRequestsFromDB(userId) {
  try {
    const snapshot = await db
      .collection("friend_requests")
      .where("receiverId", "==", userId)
      .where("status", "==", "pending")
      .get();
    if (snapshot.empty) return [];

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
    return requests;
  } catch (error) {
    console.error("Erro ao buscar pedidos de amizade:", error);
    return [];
  }
}

async function getSentRequestsFromDB(userId) {
  try {
    const snapshot = await db
      .collection("friend_requests")
      .where("senderId", "==", userId)
      .where("status", "==", "pending")
      .get();
    if (snapshot.empty) return [];

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
    return requests;
  } catch (error) {
    console.error("Erro ao buscar pedidos enviados:", error);
    return [];
  }
}

async function getFriendsFromDB(userId) {
  try {
    const userDoc = await db.collection("users").doc(userId).get();
    if (
      !userDoc.exists ||
      !userDoc.data().friends ||
      userDoc.data().friends.length === 0
    ) {
      return [];
    }

    const friendIds = userDoc.data().friends;
    const friends = [];
    for (const friendId of friendIds) {
      const friendDoc = await db.collection("users").doc(friendId).get();
      if (friendDoc.exists) {
        friends.push(friendDoc.data());
      }
    }
    return friends;
  } catch (error) {
    console.error("Erro ao buscar amigos:", error);
    return [];
  }
}

// --- Funções de Renderização ---
function renderUserCard(user, type, requestId = null) {
  const defaultAvatar = "https://placehold.co/40x40/1f1f1f/ffffff?text=U";
  let actionsHtml = "";
  let cardClass = "user-card";

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
      cardClass += " is-friend";
      actionsHtml = `<button class="remove-btn" data-id="${user.uid}">${t(
        "friends.remove_button"
      )}</button>`;
      break;
  }

  return `<div class="${cardClass}" data-friend-id="${
    type === "friend" ? user.uid : ""
  }">
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

async function loadFriendData() {
  if (!currentUser) return;
  const requests = await getFriendRequestsFromDB(currentUser.uid);
  renderFriendRequests(requests);

  const sentRequests = await getSentRequestsFromDB(currentUser.uid);
  renderSentRequests(sentRequests);

  const friends = await getFriendsFromDB(currentUser.uid);
  renderFriendsList(friends);
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

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      await loadFriendData();
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
    const target = e.target;

    const actionButton = target.closest("button");
    if (actionButton) {
      const targetId = actionButton.dataset.id;
      if (actionButton.classList.contains("add-btn")) {
        await db.collection("friend_requests").add({
          senderId: currentUser.uid,
          receiverId: targetId,
          status: "pending",
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        actionButton.textContent = t("friends.sent_button");
        actionButton.disabled = true;
        loadFriendData();
      } else if (actionButton.classList.contains("accept-btn")) {
        const requestRef = db.collection("friend_requests").doc(targetId);
        const requestDoc = await requestRef.get();
        if (!requestDoc.exists) return;
        const senderId = requestDoc.data().senderId;

        const batch = db.batch();
        batch.update(requestRef, { status: "accepted" });
        batch.update(db.collection("users").doc(currentUser.uid), {
          friends: firebase.firestore.FieldValue.arrayUnion(senderId),
        });
        batch.update(db.collection("users").doc(senderId), {
          friends: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
        });
        await batch.commit();
        loadFriendData();
      } else if (actionButton.classList.contains("decline-btn")) {
        await db
          .collection("friend_requests")
          .doc(targetId)
          .update({ status: "rejected" });
        loadFriendData();
      } else if (actionButton.classList.contains("cancel-btn")) {
        await db.collection("friend_requests").doc(targetId).delete();
        loadFriendData();
      } else if (actionButton.classList.contains("remove-btn")) {
        const batch = db.batch();
        batch.update(db.collection("users").doc(currentUser.uid), {
          friends: firebase.firestore.FieldValue.arrayRemove(targetId),
        });
        batch.update(db.collection("users").doc(targetId), {
          friends: firebase.firestore.FieldValue.arrayRemove(currentUser.uid),
        });
        await batch.commit();
        loadFriendData();
      }
      return;
    }

    const friendCard = target.closest(".user-card.is-friend");
    if (friendCard) {
      const friendId = friendCard.dataset.friendId;
      if (friendId) {
        window.electronAPI.navigateToUserProfile(friendId);
      }
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
