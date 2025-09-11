import { applyAppearance } from "./appearance.js";

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
  const settings = await window.electronAPI.loadSettings();
  applyAppearance(settings);
  await applyTranslations(settings.language || "pt");

  const closeBtn = document.getElementById("close-btn");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      window.close();
    });
  }
});
