
export async function translateText(text, targetLang) {
  if (!text || targetLang === "en") {
    return text;
  }

  const url = new URL("https://translate.googleapis.com/translate_a/single");
  const params = {
    client: "gtx",
    sl: "en",       // Idioma de origem 
    tl: targetLang, // Idioma de destino 
    dt: "t",        // Retorna a tradução do texto
    q: text,        // O texto a ser traduzido
  };

  Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const translatedText = data[0].map(item => item[0]).join('');

    if (translatedText) {
      return translatedText;
    }
    
    throw new Error('Não foi possível extrair o texto traduzido da resposta.');

  } catch (error) {
    console.error("Erro na tradução:", error);
    return text;
  }
}