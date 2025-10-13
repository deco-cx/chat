/**
 * Create accessibilty tools for MCP tools.
 *
 * This is used to control access to MCP tools.
 */
export const createResourceAccess = () => {
  let canAccess = true;

  return {
    /**
     * Call this function to grant access to the tool.
     * If you don't call this function, the tool will be denied access.
     *
     * This is to make sure the developer is aware of the access control when developing the tool.
     */
    grant: () => {
      canAccess = true;
      return {
        [Symbol.dispose]: () => {
          canAccess = false;
        },
      };
    },
    granted: () => canAccess,
  };
};

export type ResourceAccess = ReturnType<typeof createResourceAccess>;
