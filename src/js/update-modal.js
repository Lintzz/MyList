import { applyAppearance } from "./appearance.js";

document.addEventListener("DOMContentLoaded", () => {
  const installBtn = document.getElementById("install-btn");
  const laterBtn = document.getElementById("later-btn");

  installBtn.addEventListener("click", () => {
    window.electronAPI.installUpdate();
  });

  laterBtn.addEventListener("click", () => {
    window.electronAPI.closeUpdateModal();
  });

  // Recebe as configurações (tema, idioma) do processo principal
  window.electronAPI.onUpdateModalInfo(async (settings) => {
    applyAppearance(settings);

    const response = await fetch(
      `../locales/${settings.language || "pt"}.json`
    );
    const translations = await response.json();
    const t = (key) =>
      key.split(".").reduce((obj, i) => obj?.[i], translations) || key;

    document.querySelector('[data-i18n="app.update_available"]').textContent =
      t("app.update_available");
    document.querySelector(
      '[data-i18n="app.update_dialog_message"]'
    ).textContent = t("app.update_dialog_message");
    installBtn.textContent = t("app.update_now_button");
    laterBtn.textContent = t("app.update_dialog_button_later");
  });
});
