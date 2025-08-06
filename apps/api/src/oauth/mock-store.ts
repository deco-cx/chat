// Simple in-memory store for OAuth codes (replace with real DB later)
interface OAuthCode {
  code: string;
  claims: any;
  workspace: string;
  expires_at: string;
  created_at: string;
}

const oauthCodes = new Map<string, OAuthCode>();

export const mockOAuthStore = {
  // Store a new OAuth code
  insert: async (data: OAuthCode) => {
    console.log('Mock storing OAuth code:', data.code);
    oauthCodes.set(data.code, data);
    return { error: null };
  },

  // Find an OAuth code
  findByCode: async (code: string) => {
    console.log('Mock looking up OAuth code:', code);
    const data = oauthCodes.get(code);
    
    if (!data) {
      return { data: null, error: { message: 'Code not found' } };
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (now > expiresAt) {
      console.log('Mock OAuth code expired:', code);
      oauthCodes.delete(code);
      return { data: null, error: { message: 'Code expired' } };
    }

    return { data, error: null };
  },

  // Delete an OAuth code (after successful exchange)
  deleteByCode: async (code: string) => {
    console.log('Mock deleting OAuth code:', code);
    const existed = oauthCodes.delete(code);
    return { error: existed ? null : { message: 'Code not found' } };
  },

  // Debug: show all stored codes
  _debug_listAll: () => {
    console.log('All stored OAuth codes:', Array.from(oauthCodes.entries()));
    return Array.from(oauthCodes.values());
  },

  // Clear all OAuth codes
  _debug_clearAll: () => {
    const count = oauthCodes.size;
    oauthCodes.clear();
    console.log(`🗑️ Cleared ${count} OAuth codes from mock store`);
    return { cleared: count };
  }
};