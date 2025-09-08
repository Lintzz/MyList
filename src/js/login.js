async function applyTranslations(lang) {
  const response = await fetch(`../locales/${lang}.json`);
  const translations = await response.json();

  function translate(key) {
    return (
      key.split(".").reduce((obj, i) => (obj ? obj[i] : null), translations) ||
      key
    );
  }

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");

    if (key.startsWith("[") && key.includes("]")) {
      const match = key.match(/\[(.*?)\](.*)/);
      if (match) {
        const attr = match[1];
        const actualKey = match[2];
        element.setAttribute(attr, translate(actualKey));
      }
    } else {
      element.innerHTML = translate(key);
    }
  });

  return translate;
}

document.addEventListener("DOMContentLoaded", async () => {
  const firebaseReady = await window.firebaseInitializationPromise;
  if (!firebaseReady) {
    return;
  }

  const auth = window.firebaseAuth;
  const db = window.firebaseDb;
  const GoogleAuthProvider = firebase.auth.GoogleAuthProvider;

  const settings = await window.electronAPI.loadSettings();
  const lang = settings.language || "pt";
  const t = await applyTranslations(lang);

  await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  const googleLoginBtn = document.getElementById("google-login-btn");
  const loginStatus = document.getElementById("login-status");
  const minimizeBtn = document.getElementById("minimize-btn");
  const maximizeBtn = document.getElementById("maximize-btn");
  const closeBtn = document.getElementById("close-btn");
  const loginContainer = document.querySelector(".login-container");

  auth.onAuthStateChanged((user) => {
    if (user) {
      checkAndRedirectUser(user);
    } else {
      loginContainer.classList.remove("hidden");
      window.electronAPI.readyToShow();
    }
  });

  googleLoginBtn.addEventListener("click", () => {
    loginStatus.textContent = t("login.status_opening_browser");
    loginStatus.classList.remove("hidden");
    window.electronAPI.openExternalLink("https://minha-lista-ponte.vercel.app");
  });

  window.electronAPI.handleDeepLink(async (url) => {
    if (auth.currentUser) {
      return;
    }
    try {
      loginStatus.textContent = t("login.status_authenticating");
      const urlParams = new URLSearchParams(new URL(url).search);
      const idToken = urlParams.get("idToken");
      if (!idToken) throw new Error(t("login.status_error_token"));

      const credential = GoogleAuthProvider.credential(idToken);
      await auth.signInWithCredential(credential);
    } catch (error) {
      console.error("Erro ao processar o deep link:", error);
      loginStatus.textContent = t("login.status_error_generic").replace(
        "{{message}}",
        error.message
      );
    }
  });

  async function checkAndRedirectUser(user) {
    const userDocRef = db.collection("users").doc(user.uid);
    const docSnap = await userDocRef.get();

    if (!docSnap.exists || !docSnap.data().profileComplete) {
      if (!docSnap.exists) {
        await userDocRef.set({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          profileComplete: false,
        });
      }
      window.electronAPI.navigateToConfirmRegister();
    } else {
      window.electronAPI.navigateToHub();
    }
  }

  minimizeBtn.addEventListener("click", () =>
    window.electronAPI.minimizeWindow()
  );
  maximizeBtn.addEventListener("click", () =>
    window.electronAPI.maximizeWindow()
  );
  closeBtn.addEventListener("click", () => window.electronAPI.closeWindow());
});
