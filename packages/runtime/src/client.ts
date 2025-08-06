export type MCPClient<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (...args: any) => any
    ? (
        args: Parameters<T[K]>[0],
        init?: CustomInit,
      ) => Promise<Awaited<ReturnType<T[K]>>>
    : never;
};

export type CustomInit = RequestInit & {
  handleResponse?: (response: Response) => Promise<unknown>;
};

export const DECO_MCP_CLIENT_HEADER = "X-Deco-MCP-Client";

export const DEFAULT_INIT: CustomInit = {
  credentials: "include",
  headers: {
    [DECO_MCP_CLIENT_HEADER]: "true",
  },
};

export const createClient = <T>(init?: CustomInit): MCPClient<T> => {
  console.log({init})
  return new Proxy(
    {},
    {
      get: (_, prop) => {
        return async (args: unknown, innerInit?: CustomInit) => {
          const toolId = String(prop);
          
          // Check if we have a pending tool call from a previous auth redirect
          let isPendingRetry = false;
          if (typeof window !== 'undefined') {
            console.log('Checking for pending tool call');
            const pendingCall = localStorage.getItem('deco_pending_tool_call');
            console.log({pendingCall})
            if (pendingCall) {
              try {
                const { toolId: pendingToolId, args: pendingArgs, timestamp } = JSON.parse(pendingCall);
                
                // If this matches our pending call and it's recent (< 5 minutes)
                if (pendingToolId === toolId && Date.now() - timestamp < 5 * 60 * 1000) {
                  console.log('Resuming pending tool call after auth:', pendingToolId);
                  // Clear the pending call BEFORE using it to prevent infinite loops
                  localStorage.removeItem('deco_pending_tool_call');
                  // Use the pending args instead
                  args = pendingArgs;
                  isPendingRetry = true;
                }
              } catch (e) {
                // Ignore parsing errors
                localStorage.removeItem('deco_pending_tool_call');
              }
            }
          }

          const mergedInit: CustomInit = {
            ...init,
            ...innerInit,
            headers: {
              ...DEFAULT_INIT.headers,
              ...init?.headers,
              ...innerInit?.headers,
            },
          };

          // Check for stored scoped token for this tool
          let scopedToken: string | null = null;
          if (typeof window !== 'undefined') {
            const scopedTokenKey = `deco_scoped_token_${toolId}`;
            const storedToken = localStorage.getItem(scopedTokenKey);
            
            if (storedToken) {
              try {
                const tokenData = JSON.parse(storedToken);
                
                // Check if token is still valid
                if (Date.now() < tokenData.expiresAt) {
                  scopedToken = tokenData.token;
                  console.log(`Using stored scoped token for tool: ${toolId}`);
                } else {
                  // Token expired, remove it
                  localStorage.removeItem(scopedTokenKey);
                  console.log(`Scoped token expired for tool: ${toolId}`);
                }
              } catch (e) {
                // Invalid token data, remove it
                localStorage.removeItem(scopedTokenKey);
              }
            }
          }

          // Add scoped token to headers if available
          const requestInit = {
            method: "POST",
            body: JSON.stringify(args),
            credentials: "include" as const,
            ...mergedInit,
            headers: {
              ...mergedInit.headers,
              ...(scopedToken && { Authorization: `Bearer ${scopedToken}` }),
            },
          };

          // console.log({requestInit, hasScopedToken: !!scopedToken})

          // First, try the tool call (with scoped token if available)
          let response = await fetch(`/mcp/call-tool/${toolId}`, requestInit);

          console.log({response})

          // If we get 401, try to auto-handle auth (but only if this isn't already a retry)
          if (response.status === 401 && !isPendingRetry) {
            try {
              const errorData = await response.json() as any;
              
              // If we got an auth URL, handle the auth flow
              if (errorData.authUrl) {
                console.log('Tool requires auth, redirecting to:', errorData.authUrl);
                
                // Store the tool call details for after auth
                if (typeof window !== 'undefined') {
                  localStorage.setItem('deco_pending_tool_call', JSON.stringify({
                    toolId,
                    args,
                    timestamp: Date.now()
                  }));
                  
                  // Redirect to auth
                  window.location.href = errorData.authUrl;
                  
                  // Return a pending promise (page will redirect anyway)
                  return new Promise(() => {}); // Never resolves
                }
              }
              
              // If no auth URL, try pre-authorization flow
              console.log('Attempting pre-authorization for tool:', toolId);
              
              const preAuthResult = await preAuthorizeToolExecution(toolId);
              
              if (preAuthResult.success) {
                console.log('Pre-authorization successful, retrying with scoped token');
                
                // Retry with scoped token
                response = await fetch(`/mcp/call-tool/${toolId}`, {
                  method: "POST",
                  body: JSON.stringify(args),
                  credentials: "include",
                  ...mergedInit,
                  headers: {
                    ...mergedInit.headers,
                    Authorization: `Bearer ${preAuthResult.scopedToken}`,
                  },
                });
                
                if (!response.ok) {
                  const retryError = await response.json() as any;
                  throw new Error(retryError.error || `Tool execution failed: ${response.status}`);
                }
              } else {
                // Pre-auth failed, check if we need to redirect
                if (preAuthResult.authUrl && typeof window !== 'undefined') {
                  console.log('Pre-auth failed, redirecting to auth:', preAuthResult.authUrl);
                  
                  localStorage.setItem('deco_pending_tool_call', JSON.stringify({
                    toolId,
                    args,
                    timestamp: Date.now()
                  }));
                  
                  window.location.href = preAuthResult.authUrl;
                  return new Promise(() => {}); // Never resolves
                }
                
                throw new Error(preAuthResult.error || 'Authentication required');
              }
            } catch (authError) {
              // If anything goes wrong with auth handling, rethrow original error
              throw authError instanceof Error ? authError : new Error('Authentication failed');
            }
          } else if (response.status === 401 && isPendingRetry) {
            // This was already a retry after auth - don't try again to prevent infinite loops
            console.log('Tool call failed after auth retry, not attempting again');
            const errorData = await response.json() as any;
            throw new Error(errorData.error || 'Authentication failed after retry');
          }

          // Handle other non-OK responses
          if (!response.ok) {
            const errorData = await response.json() as any;
            throw new Error(errorData.error || `Tool execution failed: ${response.status}`);
          }

          return mergedInit.handleResponse?.(response) ?? response.json();
        };
      },
    },
  ) as MCPClient<T>;
};

/**
 * Pre-authorize a tool and get a scoped token for execution
 */
export const preAuthorizeToolExecution = async (
  toolId: string, 
  estimatedCost?: number
): Promise<{
  success: true;
  executionId: string;
  scopedToken: string;
  expiresIn: number;
  toolId: string;
  estimatedCost: number;
} | {
  success: false;
  error: string;
  authUrl?: string;
}> => {
  try {
    const response = await fetch("/tool/pre-authorize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ toolId, estimatedCost }),
    });

    const data = await response.json() as any;

    if (!response.ok) {
      return {
        success: false,
        error: data.error || "Pre-authorization failed",
        authUrl: data.authUrl,
      };
    }

    return {
      success: true,
      executionId: data.executionId,
      scopedToken: data.scopedToken,
      expiresIn: data.expiresIn,
      toolId: data.toolId,
      estimatedCost: data.estimatedCost,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Create a client that uses a scoped token for a specific tool
 */
export const createScopedToolClient = <T>(
  toolId: string,
  scopedToken: string,
  init?: CustomInit
): MCPClient<T> => {
  return new Proxy(
    {},
    {
      get: (_, prop) => {
        return async (args: unknown, innerInit?: CustomInit) => {
          // Only allow calling the tool this token is scoped for
          if (String(prop) !== toolId) {
            throw new Error(`This scoped token can only execute tool '${toolId}', not '${String(prop)}'`);
          }

          const mergedInit: CustomInit = {
            ...init,
            ...innerInit,
            headers: {
              ...DEFAULT_INIT.headers,
              ...init?.headers,
              ...innerInit?.headers,
              Authorization: `Bearer ${scopedToken}`,
            },
          };

          const response = await fetch(`/mcp/call-tool/${String(prop)}`, {
            method: "POST",
            body: JSON.stringify(args),
            credentials: "include",
            ...mergedInit,
          });

          if (!response.ok) {
            const errorData = await response.json() as any;
            throw new Error(errorData.error || `Tool execution failed: ${response.status}`);
          }

          return mergedInit.handleResponse?.(response) ?? response.json();
        };
      },
    },
  ) as MCPClient<T>;
};

/**
 * Simplified helper to pre-authorize and execute a tool in one step
 */
export const executeToolWithPreAuth = async <T>(
  toolId: string,
  args: unknown,
  estimatedCost?: number,
  init?: CustomInit
): Promise<T> => {
  // Step 1: Pre-authorize the tool
  const preAuthResult = await preAuthorizeToolExecution(toolId, estimatedCost);

  if (!preAuthResult.success) {
    if (preAuthResult.authUrl) {
      // Redirect to authentication
      window.location.href = preAuthResult.authUrl;
      throw new Error("Redirecting to authentication...");
    }
    throw new Error(preAuthResult.error);
  }

  // Step 2: Create scoped client and execute tool
  const scopedClient = createScopedToolClient<Record<string, any>>(
    toolId,
    preAuthResult.scopedToken,
    init
  );

  return scopedClient[toolId as keyof typeof scopedClient](args);
};

/**
 * Call this in your app initialization to automatically handle auth redirects
 * Clean up URL and prepare for pending tool call retry
 */
export const handleAuthRedirect = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  
  // Check if we just came back from OAuth
  const url = new URL(window.location.href);
  const isAuthCallback = url.pathname.includes('/oauth/callback') || url.searchParams.has('code');
  
  if (!isAuthCallback) return;
  
  console.log('Detected auth callback, processing OAuth response');
  
  // Check if we have a code to exchange
  const code = url.searchParams.get('code');
  if (code) {
    try {
      // Exchange the code for a token
      const response = await fetch('/apps/code-exchange', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        const tokenData = await response.json() as any;
        
        // If this is a scoped token for tool execution, store it
        if (tokenData.token_type === 'scoped' && tokenData.toolId) {
          const scopedTokenKey = `deco_scoped_token_${tokenData.toolId}`;
          localStorage.setItem(scopedTokenKey, JSON.stringify({
            token: tokenData.access_token,
            toolId: tokenData.toolId,
            workspace: tokenData.workspace,
            expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
          }));
          
          console.log(`Stored scoped token for tool: ${tokenData.toolId}`);
        } else {
          // Regular user token - store in cookie/session as usual
          console.log('Received regular auth token');
        }
      } else {
        console.error('Failed to exchange OAuth code:', response.status);
      }
    } catch (error) {
      console.error('Error exchanging OAuth code:', error);
    }
  }
  
  // Clean up URL params
  const cleanUrl = new URL(window.location.href);
  cleanUrl.search = '';
  window.history.replaceState({}, '', cleanUrl.toString());
  
  // Check for pending tool call but don't auto-retry it
  const pendingCall = localStorage.getItem('deco_pending_tool_call');
  if (pendingCall) {
    try {
      const { toolId, timestamp } = JSON.parse(pendingCall);
      
      // Check if the call is still valid (< 5 minutes old)
      if (Date.now() - timestamp > 5 * 60 * 1000) {
        localStorage.removeItem('deco_pending_tool_call');
        console.log('Pending tool call expired, cleaning up');
      } else {
        console.log(`Auth completed, pending tool call ready: ${toolId}`);
        // Don't auto-retry here - let the createClient handle it when the tool is called again
      }
    } catch (error) {
      console.error('Failed to parse pending tool call:', error);
      localStorage.removeItem('deco_pending_tool_call');
    }
  }
};

/**
 * Check if there's a pending tool call that needs auth
 */
export const hasPendingToolCall = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  const pendingCall = localStorage.getItem('deco_pending_tool_call');
  if (!pendingCall) return false;
  
  try {
    const { timestamp } = JSON.parse(pendingCall);
    return Date.now() - timestamp < 5 * 60 * 1000; // Valid for 5 minutes
  } catch {
    localStorage.removeItem('deco_pending_tool_call');
    return false;
  }
};

/**
 * Get details about the pending tool call
 */
export const getPendingToolCall = (): { toolId: string; args: any } | null => {
  if (typeof window === 'undefined') return null;
  
  const pendingCall = localStorage.getItem('deco_pending_tool_call');
  if (!pendingCall) return null;
  
  try {
    const { toolId, args, timestamp } = JSON.parse(pendingCall);
    
    // Check if still valid
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      localStorage.removeItem('deco_pending_tool_call');
      return null;
    }
    
    return { toolId, args };
  } catch {
    localStorage.removeItem('deco_pending_tool_call');
    return null;
  }
};
