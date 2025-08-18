import { AsyncLocalStorage } from 'node:async_hooks';
import type { AppContext } from './mastra.ts';
const asyncLocalStorage = new AsyncLocalStorage<AppContext | undefined>();

export const State = {
  getStore: () => {
    return asyncLocalStorage.getStore();
  },
  run: <TEnv, R, TArgs extends unknown[]>(
    ctx: AppContext<TEnv>,
    f: (...args: TArgs) => R,
    ...args: TArgs
  ): R => asyncLocalStorage.run(ctx, f, ...args),
};
