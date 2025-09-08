export function applyAppearance(settings) {
  const theme = settings.theme || "theme-dark";
  const accentColor = settings.accentColor || "blue";
  const listDensity = settings.listDensity || "compact";

  const root = document.documentElement;

  // Altera o tema
  root.dataset.theme = theme;

  // Altera a lista
  root.dataset.listDensity = listDensity;

  // Altera a cor de destaque
  root.style.setProperty(
    "--accent-color",
    `var(--accent-color-${accentColor})`
  );
}
