/**
 * __mocks__/supabase.ts
 * =======================
 * Mock complet pentru clientul Supabase în testele Jest.
 * Oferă funcții jest.fn() care pot fi configurate per test pentru a returna datele dorite.
 */

// Mock-uri pentru metodele query builder-ului
export const mockSelect = jest.fn().mockReturnThis();
export const mockInsert = jest.fn().mockReturnThis();
export const mockUpdate = jest.fn().mockReturnThis();
export const mockDelete = jest.fn().mockReturnThis();
export const mockEq = jest.fn().mockReturnThis();
export const mockOrder = jest.fn().mockReturnThis();
export const mockSingle = jest.fn().mockReturnThis();

// Mock-uri pentru rezolvarea promisiunilor (în Supabase, la final se apelează un fel de await pe query builder, 
// dar de obicei folosim direct mockResolvedValue pe ultima metodă din lanț)
export const mockExecute = jest.fn();

// Mock pentru Remote Procedure Calls (RPC)
export const mockRpc = jest.fn();

// Asamblarea builder-ului pentru tabela '.from()'
export const mockFrom = jest.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  eq: mockEq,
  order: mockOrder,
  single: mockSingle,
  execute: mockExecute,
  // Puteți adăuga și alte funcții necesare înlănțuite (ex. in, or, contains)
}));

// Funcția principală pentru a crea clientul mockat
export const mockCreateClient = jest.fn(() => ({
  from: mockFrom,
  rpc: mockRpc,
  auth: {
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
}));

// Export implicit/explicit care imită pachetul original 
export const createClient = mockCreateClient;

/**
 * Funcție helper utilitară pentru resetarea tuturor mock-urilor din Supabase
 * Poate fi apelată în beforeEach() în fișierele de test.
 */
export const resetSupabaseMocks = () => {
  mockSelect.mockReset().mockReturnThis();
  mockInsert.mockReset().mockReturnThis();
  mockUpdate.mockReset().mockReturnThis();
  mockDelete.mockReset().mockReturnThis();
  mockEq.mockReset().mockReturnThis();
  mockOrder.mockReset().mockReturnThis();
  mockSingle.mockReset().mockReturnThis();
  mockExecute.mockReset();
  mockRpc.mockReset();
  mockFrom.mockClear();
  mockCreateClient.mockClear();
};
