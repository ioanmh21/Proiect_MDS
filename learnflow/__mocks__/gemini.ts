/**
 * __mocks__/gemini.ts
 * =====================
 * Mock complet pentru @google/generative-ai (Google Gemini) în testele Jest.
 * Simulează interacțiunile principale: generateContent, generateContentStream,
 * embedContent și logica de startChat.
 */

// Metode pentru instanța modelului generativ
export const mockGenerateContent = jest.fn();
export const mockGenerateContentStream = jest.fn();
export const mockEmbedContent = jest.fn();

// Metode pentru Sesiunea de Chat
export const mockSendMessage = jest.fn();
export const mockStartChat = jest.fn(() => ({
  sendMessage: mockSendMessage,
}));

// Modelul Generativ mockat
export const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
  generateContentStream: mockGenerateContentStream,
  embedContent: mockEmbedContent,
  startChat: mockStartChat,
}));

// Export care imită constructorul SDK-ului oficial
export const GoogleGenerativeAI = jest.fn(() => ({
  getGenerativeModel: mockGetGenerativeModel,
}));

/**
 * Helper pentru a seta rapid un răspuns text mockat pentru generateContent sau sendMessage.
 */
export const setMockGenerateContentResponse = (textResponse: string) => {
  mockGenerateContent.mockResolvedValue({
    response: {
      text: () => textResponse,
    },
  });
};

export const setMockChatMessageResponse = (textResponse: string) => {
  mockSendMessage.mockResolvedValue({
    response: {
      text: () => textResponse,
    },
  });
};

/**
 * Helper pentru a seta un răspuns mockat de tip Stream (Generator asincron)
 */
export const setMockGenerateContentStreamResponse = async function* (chunks: string[]) {
  for (const chunk of chunks) {
    yield {
      text: () => chunk,
    };
  }
};

/**
 * Helper pentru a simula generarea de Embeddings.
 * Dacă nu este furnizat un array, va returna un array de 768 dimensiuni completat cu 0.1
 */
export const setMockEmbedContentResponse = (embeddingValues?: number[]) => {
  const values = embeddingValues || new Array(768).fill(0.1);
  mockEmbedContent.mockResolvedValue({
    embedding: {
      values,
    },
  });
};

/**
 * Funcție utilitară pentru a reseta toate mock-urile.
 */
export const resetGeminiMocks = () => {
  mockGenerateContent.mockReset();
  mockGenerateContentStream.mockReset();
  mockEmbedContent.mockReset();
  mockSendMessage.mockReset();
  mockStartChat.mockClear();
  mockGetGenerativeModel.mockClear();
};
