import { showErrorModal } from "./modal.js";

/**
 * Carrega os dados do usuário e uma lista de mídia específica do Firestore.
 */
export async function carregarDadosUsuario(db, userId, mediaType) {
  if (!userId) {
    return { userData: null, mediaList: [] };
  }

  const userDocRef = db.collection("users").doc(userId); // Sintaxe v8
  try {
    const docSnap = await userDocRef.get(); // Sintaxe v8
    if (docSnap.exists) {
      const data = docSnap.data();
      const userData = {
        displayName: data.displayName || "Utilizador",
        photoURL:
          data.photoURL || "https://placehold.co/40x40/1f1f1f/ffffff?text=U",
      };
      const mediaList = data.lists?.[mediaType] || [];
      return { userData, mediaList };
    } else {
      return { userData: { displayName: "Utilizador" }, mediaList: [] };
    }
  } catch (error) {
    console.error("Erro ao carregar dados do Firestore:", error);
    showErrorModal(
      "Erro de Conexão",
      "Não foi possível carregar a sua lista. Verifique a sua conexão com a internet."
    );
    return { userData: null, mediaList: [] };
  }
}

/**
 * Salva uma lista completa de mídia no Firestore para um usuário específico.
 */
export async function salvarLista(db, userId, mediaList, mediaType) {
  if (!userId || !mediaType) {
    console.error("Tentativa de salvar sem um ID de usuário ou tipo de mídia.");
    return false;
  }

  const userDocRef = db.collection("users").doc(userId); // Sintaxe v8
  try {
    await userDocRef.set(
      {
        lists: {
          [mediaType]: mediaList,
        },
      },
      { merge: true }
    );
    return true;
  } catch (error) {
    console.error(
      `Erro ao salvar a lista de ${mediaType} no Firestore:`,
      error
    );
    showErrorModal(
      "Erro ao Salvar",
      "Não foi possível salvar as alterações. Verifique sua conexão e tente novamente."
    );
    return false;
  }
}
