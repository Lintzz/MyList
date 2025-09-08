async function initializeFirebase() {
  try {
    const firebaseConfig = await window.electronAPI.getFirebaseConfig();
    if (!firebaseConfig || !firebaseConfig.apiKey) {
      throw new Error(
        "Configuração do Firebase não encontrada ou inválida. Verifique o seu ficheiro .env."
      );
    }

    const app = firebase.initializeApp(firebaseConfig);
    window.firebaseAuth = firebase.auth();
    window.firebaseDb = firebase.firestore();

    await window.firebaseDb.enablePersistence().catch((err) => {
      if (err.code == "failed-precondition") {
        console.warn(
          "Múltiplas abas abertas, a persistência pode não funcionar."
        );
      } else if (err.code == "unimplemented") {
        console.log("O navegador atual não suporta persistência.");
      }
    });

    console.log("Firebase inicializado com sucesso.");
    return true;
  } catch (err) {
    console.error("Falha grave ao inicializar o Firebase:", err);
    document.body.innerHTML = `
      <div style="color: white; padding: 20px; font-family: sans-serif; height: 100vh; background-color: #121212;">
        <h1>Erro Crítico de Configuração</h1>
        <p>Não foi possível iniciar a aplicação. Verifique o seguinte:</p>
        <ul>
            <li>Se o ficheiro <code>.env</code> existe na raiz do projeto.</li>
            <li>Se todas as chaves no ficheiro <code>.env</code> estão corretas e sem aspas extras.</li>
            <li>Sua conexão com a internet.</li>
        </ul>
        <pre style="color: #ff9999; white-space: pre-wrap;">Detalhes do erro: ${err.message}</pre>
      </div>
    `;
    return false;
  }
}

window.firebaseInitializationPromise = initializeFirebase();
