import {
  createContext,
  type Dispatch,
  type PropsWithChildren,
  type Reducer,
  useContext,
  useReducer,
} from "react";

type BaseState = object;

type UpdateAction<S extends BaseState> = {
  type: `update-${keyof S & string}`;
  payload: S[keyof S & string];
};

type SetAction<S extends BaseState> = {
  type: `set-${keyof S & string}`;
  payload: S[keyof S & string];
};

export type Action<S extends BaseState> =
  | UpdateAction<S>
  | SetAction<S>;

// True if all elements in set1 are in set2
const equalsSet = (set1?: Set<string>, set2?: Set<string>) => {
  if (!set1 || !set2) {
    return false;
  }

  if (set1.size !== set2.size) {
    return false;
  }

  for (const value of set1) {
    if (!set2.has(value)) {
      return false;
    }
  }

  return true;
};

const equals = (a: unknown, b: unknown) => {
  if (a instanceof Set && b instanceof Set) {
    return equalsSet(a, b);
  }

  return a === b;
};

const reducer =
  <S extends BaseState>(middlewares: Middlewares<S>) =>
  (state: S, action: Action<S>): S => {
    if (action.type.startsWith("update-")) {
      const key = action.type.slice("update-".length) as keyof S;
      const prev = state[key];
      const next = action.payload;

      if (equals(prev, next)) {
        return state;
      }

      const nextState = { ...state, [key]: action.payload };

      middlewares[key]?.(nextState);

      return nextState;
    }

    if (action.type.startsWith("set-")) {
      const key = action.type.slice("set-".length) as keyof S;

      const nextState = { ...state, [key]: action.payload };

      middlewares[key]?.(nextState);

      return nextState;
    }

    throw new Error("Unknown action");
  };

type Middleware<S extends BaseState> = (nextState: S) => void;

type Middlewares<S extends BaseState> = {
  [K in keyof S]?: Middleware<S>;
};

interface CreateStoreOptions<S extends BaseState> {
  initializer: (props: Partial<S>) => S;
  middlewares?: Middlewares<S>;
}

export const createStore = <S extends BaseState, P = never>(
  { initializer, middlewares = {} }: CreateStoreOptions<S>,
) => {
  const Context = createContext<
    { state: S; dispatch: Dispatch<Action<S>>; initialState: Partial<P> } | null
  >(null);

  const Provider = (
    { children, initialState, ...partialState }: PropsWithChildren<
      Partial<S> & { initialState?: Partial<P> }
    >,
  ) => {
    const [state, dispatch] = useReducer(
      reducer(middlewares) as Reducer<S, Action<S>>,
      partialState as Partial<S>,
      initializer,
    );

    return (
      <Context.Provider
        value={{
          state,
          initialState: initialState || {},
          dispatch,
        }}
      >
        {children}
      </Context.Provider>
    );
  };

  const useStore = () => {
    const context = useContext(Context);

    if (!context) {
      throw new Error("useStore must be used within a Provider");
    }

    return context;
  };

  return { Provider, useStore };
};
