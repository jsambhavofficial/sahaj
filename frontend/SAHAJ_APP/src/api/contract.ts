/**
 * Where the Sahaj backend lives. Set EXPO_PUBLIC_API_BASE_URL in .env (see .env.example).
 * Expo inlines process.env.EXPO_PUBLIC_* at build time, so it must be read with dot notation.
 *
 * The API itself is called from ./http.ts and ./live.ts; the contract is documented in
 * backend/docs/api-contract.md.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://sahaj-irgo.onrender.com/api/v1';
