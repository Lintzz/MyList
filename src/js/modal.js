const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalBtnConfirm = document.getElementById("modal-btn-confirm");
const modalBtnCancel = document.getElementById("modal-btn-cancel");

let confirmCallback = null;

export function showConfirmationModal(
  title,
  message,
  onConfirm,
  isDestructive = true,
  confirmText = "Confirmar"
) {
  modalTitle.textContent = title;
  modalMessage.innerHTML = message; // MODIFICADO: De textContent para innerHTML
  confirmCallback = onConfirm;

  modalBtnConfirm.style.display = "inline-block";
  modalBtnCancel.style.display = "inline-block";
  modalBtnConfirm.textContent = confirmText;

  if (isDestructive) {
    modalBtnConfirm.classList.add("destructive");
  } else {
    modalBtnConfirm.classList.remove("destructive");
  }

  modalOverlay.classList.remove("hidden");
  setTimeout(() => modalOverlay.classList.add("visible"), 10);
}

export function showErrorModal(title, message) {
  modalTitle.textContent = title;
  modalMessage.innerHTML = message; // MODIFICADO: De textContent para innerHTML
  confirmCallback = null;

  modalBtnConfirm.style.display = "inline-block";
  modalBtnCancel.style.display = "none";
  modalBtnConfirm.textContent = "OK";
  modalBtnConfirm.classList.remove("destructive");

  modalOverlay.classList.remove("hidden");
  setTimeout(() => modalOverlay.classList.add("visible"), 10);
}

function hideModal() {
  modalOverlay.classList.remove("visible");
  setTimeout(() => {
    modalOverlay.classList.add("hidden");
    confirmCallback = null;
  }, 200);
}

modalBtnConfirm.addEventListener("click", () => {
  if (typeof confirmCallback === "function") {
    confirmCallback();
  }
  hideModal();
});

modalBtnCancel.addEventListener("click", hideModal);

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    hideModal();
  }
});
