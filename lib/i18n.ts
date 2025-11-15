"use client"

export const translations = {
  es: {
    // Header
    title: "Proof of Che",
    subtitle: "Evalúa qué tan argentina es tu experiencia usando inteligencia artificial",

    // Form
    formTitle: "Evalúa tu experiencia argentina",
    formDescription: "Sube una imagen o describe una experiencia y obtén un puntaje de qué tan argentina es (0-100)",
    uploadImageLabel: "Sube una imagen (opcional)",
    uploadButton: "Subir imagen",
    analyzingImage: "Analizando imagen...",
    imageAnalysisLabel: "Análisis de imagen:",
    imageQuality: "Calidad",
    aiGenerated: "Generada por IA",
    imageHelp: "La IA analizará la imagen y completará automáticamente el formulario",
    clearImage: "Quitar imagen",

    descriptionLabel: "Descripción de la experiencia",
    descriptionPlaceholder: "Ej: Tomando mate con amigos en la costanera después del partido.",

    tagsLabel: "Tags (opcional, separados por comas)",
    tagsPlaceholder: "Ej: sports, food, touristic",
    tagsHelp: "Tags sugeridos: food, sports, customs, touristic, famous_people, cultural_shocks, devconnect_crypto",

    usernameLabel: "Nombre (opcional)",
    usernamePlaceholder: "Tu nombre",
    emailLabel: "Email (opcional)",
    emailPlaceholder: "tu@email.com",

    evaluateButton: "Evaluar Experiencia",
    evaluating: "Evaluando...",
    saving: "Guardando...",

    errorLabel: "Error:",
    imageError: "Por favor sube un archivo de imagen válido",
    imageSizeError: "La imagen debe ser menor a 5MB",

    // Results
    resultTitle: "Resultado",
    scoreLabel: "Score:",
    messageLabel: "Mensaje:",
    evaluatedDescription: "Descripción evaluada:",
    tagsLabel2: "Tags:",
    autoSaved: "Guardado automáticamente en el leaderboard",
    tracksLabel: "Tracks:",

    scoreRanges: {
      high: "Ícono nacional o símbolo cultural fuerte",
      mediumHigh: "Claramente argentino",
      mediumLow: "Parcialmente argentino o ambiguo",
      low: "Nada argentino o genérico",
    },

    // Examples
    examplesTitle: "Ejemplos",
    examplesDescription: "Haz clic en un ejemplo para cargarlo en el formulario",
    example1: "Tomando mate con amigos en la costanera después del partido.",
    example2: "Joven con camiseta de Boca Juniors en La Bombonera.",
    example3: "Comiendo asado con familia en un domingo de verano.",
    example4: "Tomando café en un coworking de Berlín.",
    exampleLabel: "Ejemplo",

    // Leaderboard
    leaderboardTitle: "Leaderboards - Top 5",
    leaderboardDescription: "Los mejores puntajes por categoría",
    loadingRankings: "Cargando rankings...",
    anonymous: "Anónimo",
    noEntries: "No hay entradas en este track todavía",
    beFirst: "¡Sé el primero en subir tu experiencia!",
  },
  en: {
    // Header
    title: "Proof of Che",
    subtitle: "Evaluate how Argentinean your experience is using artificial intelligence",

    // Form
    formTitle: "Evaluate your Argentinean experience",
    formDescription: "Upload an image or describe an experience and get a score of how Argentinean it is (0-100)",
    uploadImageLabel: "Upload an image (optional)",
    uploadButton: "Upload image",
    analyzingImage: "Analyzing image...",
    imageAnalysisLabel: "Image analysis:",
    imageQuality: "Quality",
    aiGenerated: "AI generated",
    imageHelp: "AI will analyze the image and automatically fill the form",
    clearImage: "Remove image",

    descriptionLabel: "Experience description",
    descriptionPlaceholder: "E.g: Drinking mate with friends by the waterfront after the game.",

    tagsLabel: "Tags (optional, comma separated)",
    tagsPlaceholder: "E.g: sports, food, touristic",
    tagsHelp: "Suggested tags: food, sports, customs, touristic, famous_people, cultural_shocks, devconnect_crypto",

    usernameLabel: "Name (optional)",
    usernamePlaceholder: "Your name",
    emailLabel: "Email (optional)",
    emailPlaceholder: "your@email.com",

    evaluateButton: "Evaluate Experience",
    evaluating: "Evaluating...",
    saving: "Saving...",

    errorLabel: "Error:",
    imageError: "Please upload a valid image file",
    imageSizeError: "Image must be smaller than 5MB",

    // Results
    resultTitle: "Result",
    scoreLabel: "Score:",
    messageLabel: "Message:",
    evaluatedDescription: "Evaluated description:",
    tagsLabel2: "Tags:",
    autoSaved: "Automatically saved to leaderboard",
    tracksLabel: "Tracks:",

    scoreRanges: {
      high: "National icon or strong cultural symbol",
      mediumHigh: "Clearly Argentinean",
      mediumLow: "Partially Argentinean or ambiguous",
      low: "Not Argentinean or generic",
    },

    // Examples
    examplesTitle: "Examples",
    examplesDescription: "Click an example to load it in the form",
    example1: "Drinking mate with friends by the waterfront after the game.",
    example2: "Young person wearing Boca Juniors jersey at La Bombonera.",
    example3: "Eating asado with family on a summer Sunday.",
    example4: "Having coffee at a coworking space in Berlin.",
    exampleLabel: "Example",

    // Leaderboard
    leaderboardTitle: "Leaderboards - Top 5",
    leaderboardDescription: "Best scores by category",
    loadingRankings: "Loading rankings...",
    anonymous: "Anonymous",
    noEntries: "No entries in this track yet",
    beFirst: "Be the first to upload your experience!",
  },
}

export type Language = "es" | "en"

export function getBrowserLanguage(): Language {
  if (typeof window === "undefined") return "es"

  const browserLang = navigator.language.toLowerCase()

  // If browser language starts with 'es', use Spanish, otherwise English
  return browserLang.startsWith("es") ? "es" : "en"
}

export function useTranslations() {
  const lang = getBrowserLanguage()
  return translations[lang]
}
