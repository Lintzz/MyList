import { applyAppearance } from "./appearance.js";
import { applyTranslations } from "./views/view-helper.js";

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
