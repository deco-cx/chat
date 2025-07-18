// deno-lint-ignore-file
/**
 * State labels can be strings
 */
type StateType = IndexType;

/**
 * Action labels can be strings
 */
export type ActionNameType = IndexType;

/**
 * Represents a state and data and its corresponding data.
 */
export type State<S extends StateType, D = unknown> = Readonly<D> & {
  readonly stateName: S;
};

/**
 * Give Actions to nextState() to (maybe) trigger a transition.
 */
export type Action<Name extends ActionNameType, Payload> = Readonly<Payload> & {
  readonly actionName: Name;
};

///
/// Errors
///

/**
 * Represents a compiler error message. Error brands prevent really clever users from naming their states as one of the error messages
 * and subverting error checking. Yet, the compiler still displays the string at the end of the failed cast indicating what the
 * issue is rather than something puzzling like could not assign to never.
 */
type ErrorBrand<T extends IndexType> = { [k in T]: void };

type IndexType = string | number;

/// Validators
type AssertStateInMap<
  StateMap,
  S extends StateType,
> = S extends MapKeys<StateMap> ? S : ErrorBrand<`'${S}' is not a state`>;
type AssertNewState<S extends StateType, States> = S extends MapKeys<States>
  ? ErrorBrand<`'${S}' has already been declared`>
  : S;
type AssertNewTransition<
  S extends StateType,
  N extends StateType,
  Transitions,
> = N extends MapLookup<Transitions, S>
  ? ErrorBrand<`There already exists a transition from '${S}' to '${N}'`>
  : N;
type AssertActionNotDefined<
  AN extends ActionNameType,
  ActionNames extends IndexType,
> = AN extends ActionNames ? ErrorBrand<`Action '${AN}' already declared`> : AN;
type AssertActionIsDefined<
  AN extends ActionNameType,
  ActionNames extends IndexType,
> = AN extends ActionNames ? AN : ErrorBrand<`'${AN}' is not an action`>;
type AssertAllNonTerminalStatesHandled<Transitions, HandledStates> =
  MapKeys<Transitions> extends HandledStates
    ? void
    : ErrorBrand<`No handlers declared for ${Exclude<MapKeys<Transitions>, HandledStates>}`>;

type StateMachineDefinition<S, A> = {
  handlers: {
    [s: string]: {
      [a: string]: (cur: MapValues<S>, action: MapValues<A>) => MapValues<S>;
    };
  };
};

// Allows us to append multiple values for the same key in a type map.
type AddToTypeMap<M, K extends string | number | symbol, V> = M | [K, V];

type MapLookup<Map, K extends string | number | symbol> = Map extends [
  K,
  infer V,
]
  ? V
  : never;
type MapKeys<Map> = Map extends [infer K, infer _]
  ? K extends IndexType
    ? K
    : never
  : never;
type MapValues<Map> = Map extends [infer _, infer V] ? V : never;

///
/// stateMachine() builder
///

/**
 * A builder from calling stateMachine().
 */
export type StateMachineBuilder = {
  /**
   * Add a state to this state machine.
   */
  readonly state: StateFunc<never>;
};

type StateMachineFunc = () => StateMachineBuilder;

///
/// .state() builder
///

/**
 * A builder from calling .state()
 */
export type StateBuilder<StateMap> = {
  /**
   * Add a state to this state machine.
   */
  readonly state: StateFunc<StateMap>;

  readonly transition: TransitionFunc<StateMap, never>;
};

/**
 * The signature for calling the state function in the builder.
 */
type StateFunc<StateMap> = <S extends StateType, Data = unknown>(
  state: AssertNewState<S, StateMap>,
) => StateBuilder<AddToTypeMap<StateMap, S, State<S, Data>>>;

///
/// .transition() builder
///

/**
 * The builder returned by .transition()
 */
export type TransitionBuilder<StateMap, Transitions> = {
  /**
   * Add a transition to this state machine.
   */
  readonly transition: TransitionFunc<StateMap, Transitions>;

  readonly action: ActionFunc<StateMap, Transitions, never>;
};

/**
 * The signature of .transition()
 */
export type TransitionFunc<StateMap, Transitions> = <
  S extends StateType,
  N extends StateType,
>(
  curState: AssertStateInMap<StateMap, S>,
  nextState: N extends MapKeys<StateMap>
    ? AssertNewTransition<S, N, Transitions>
    : ErrorBrand<`${S} is not a declared state`>,
) => TransitionBuilder<StateMap, AddToTypeMap<Transitions, S, N>>;

///
/// .action() builder
///

export type ActionBuilder<StateMap, Transitions, ActionsMap> = {
  readonly action: ActionFunc<StateMap, Transitions, ActionsMap>;

  readonly actionHandler: ActionHandlerFunc<
    StateMap,
    Transitions,
    ActionsMap,
    never
  >;
};

export type ActionFunc<StateMap, Transitions, ActionsMap> = <
  AN extends ActionNameType,
  AP = unknown,
>(
  actionName: AssertActionNotDefined<AN, MapKeys<ActionsMap>>,
) => ActionBuilder<
  StateMap,
  Transitions,
  AddToTypeMap<ActionsMap, AN, Action<AN, AP>>
>;

///
/// .actionsHandler() builder.
///

/**
 * The builder returned by .actionHandler()
 */
export type ActionHandlersBuilder<
  StateMap,
  Transitions,
  ActionsMap,
  HandledStates,
> = {
  readonly actionHandler: ActionHandlerFunc<
    StateMap,
    Transitions,
    ActionsMap,
    HandledStates
  >;

  readonly done: DoneFunc<StateMap, ActionsMap, Transitions, HandledStates>;
};

/**
 * The Signature of .actionHandler().
 */
export type ActionHandlerFunc<StateMap, Transitions, ActionMap, HandledStates> =
  <
    S extends StateType,
    AN extends ActionNameType,
    NS extends MapValues<StateMap>,
  >(
    // TODO: Checking that the action and state pair haven't already been declared here causes
    state: AssertStateInMap<StateMap, S>,
    action: AssertActionIsDefined<AN, MapKeys<ActionMap>>,
    handler: ActionHandlerCallback<StateMap, Transitions, S, AN, NS, ActionMap>,
  ) => ActionHandlersBuilder<
    StateMap,
    Transitions,
    ActionMap,
    HandledStates | S
  >;

type ActionHandlerCallback<
  States,
  Transitions,
  CS extends StateType,
  AN extends ActionNameType,
  NS extends MapValues<States>,
  Actions,
> = (
  state: MapLookup<States, CS>,
  action: MapLookup<Actions, AN>,
) => NS extends State<infer N, infer ND>
  ? N extends MapKeys<States>
    ? CS extends MapKeys<Transitions>
      ? N extends MapLookup<Transitions, CS>
        ? State<N, ND>
        : ErrorBrand<`No transition declared between ${CS} and ${N}`>
      : ErrorBrand<`State ${CS} is terminal and has no transitions`>
    : ErrorBrand<`${N} is not a state`>
  : ErrorBrand<"The returned value is not a state">;

///
/// .done()
///
type DoneBuilder = <StateMap, ActionMap, Transitions, HandledStates>(
  definition: StateMachineDefinition<StateMap, ActionMap>,
) => DoneFunc<StateMap, ActionMap, Transitions, HandledStates>;

// Check that the only unhandled states in the handler map are final states (i.e, they have no transitions out of them)
type DoneFunc<StateMap, ActionMap, Transitions, HandledStates> = (
  _: AssertAllNonTerminalStatesHandled<Transitions, HandledStates>,
) => StateMachine<StateMap, ActionMap>;

/**
 * A state machine
 */
export type StateMachine<StateMap, ActionMap> = {
  nextState: (
    curState: MapValues<StateMap>,
    action: MapValues<ActionMap>,
  ) => MapValues<StateMap>;
};

export const stateMachine: StateMachineFunc = (): StateMachineBuilder => {
  const stateFunc = state<never>();

  return {
    state: stateFunc,
  };
};

const state = <StateMap>(): StateFunc<StateMap> => {
  return <S extends StateType, D = unknown>(
    _s: AssertNewState<S, StateMap>,
  ) => {
    type NewStateMap = AddToTypeMap<StateMap, S, State<S, D>>;

    const transitionFunc = transition<NewStateMap, never>();
    const stateFunc = state<NewStateMap>();

    const builder = {
      state: stateFunc,
      transition: transitionFunc,
    };

    return builder;
  };
};

const transition = <StateMap, Transitions>(): TransitionFunc<
  StateMap,
  Transitions
> => {
  return <S extends StateType, N extends StateType>(
    _curState: AssertStateInMap<StateMap, S>,
    _next: N extends MapKeys<StateMap>
      ? AssertNewTransition<S, N, Transitions>
      : ErrorBrand<`${S} is not a declared state`>,
  ) => {
    type NewTransitions = AddToTypeMap<Transitions, S, N>;

    const transitionFunction = transition<StateMap, NewTransitions>();
    const actionFunc = action<StateMap, NewTransitions, never>();

    return {
      transition: transitionFunction,
      action: actionFunc,
    };
  };
};

const action = <StateMap, Transitions, ActionMap>(): ActionFunc<
  StateMap,
  Transitions,
  ActionMap
> => {
  return <AN extends ActionNameType, AP = unknown>(
    _actionName: AssertActionNotDefined<AN, MapKeys<ActionMap>>,
  ) => {
    type NewActionMap = AddToTypeMap<ActionMap, AN, Action<AN, AP>>;

    // @ts-ignore - Vendor code: Type inference is complex in recursive generic functions
    const actionFunc: unknown = action<StateMap, Transitions, NewActionMap>();
    // @ts-ignore - Vendor code: Type inference is complex in recursive generic functions
    const actionHandlerFunc = actionHandler<
      StateMap,
      Transitions,
      NewActionMap,
      never
    >({ handlers: {} });

    return {
      action: actionFunc as ActionFunc<StateMap, Transitions, NewActionMap>,
      actionHandler: actionHandlerFunc,
    };
  };
};

const actionHandler = <StateMap, Transitions, ActionMap, HandledStates>(
  definition: StateMachineDefinition<StateMap, ActionMap>,
): ActionHandlerFunc<StateMap, Transitions, ActionMap, HandledStates> => {
  return <
    S extends StateType,
    AN extends ActionNameType,
    NS extends MapValues<StateMap>,
  >(
    state: AssertStateInMap<StateMap, S>,
    action: AssertActionIsDefined<AN, MapKeys<ActionMap>>,
    handler: ActionHandlerCallback<StateMap, Transitions, S, AN, NS, ActionMap>,
  ) => {
    const untypedState = state as unknown as S;
    const untypedAction = action as unknown as AN;
    const newDefinition: StateMachineDefinition<StateMap, ActionMap> = {
      ...definition,
      // @ts-ignore - Vendor code: Type inference is complex in recursive generic functions
      handlers: {
        ...definition.handlers,
        [untypedState]: {
          ...(definition.handlers[untypedState]
            ? definition.handlers[untypedState]
            : {}),
          [untypedAction]: handler as unknown,
        },
      },
    };

    type NextHandledStates = HandledStates | S;

    const doneFunc = done<StateMap, ActionMap, Transitions, NextHandledStates>(
      newDefinition,
    );
    const actionHandlerFunc = actionHandler<
      StateMap,
      Transitions,
      ActionMap,
      NextHandledStates
    >(newDefinition);

    return {
      actionHandler: actionHandlerFunc,
      done: doneFunc,
    };
  };
};

const done: DoneBuilder = <StateMap, ActionMap, Transitions, HandledStates>(
  definition: StateMachineDefinition<StateMap, ActionMap>,
) => {
  const doneFunc: DoneFunc<StateMap, ActionMap, Transitions, HandledStates> = (
    _: AssertAllNonTerminalStatesHandled<Transitions, HandledStates>,
  ): StateMachine<StateMap, ActionMap> => {
    const nextStateFunction = (
      curState: MapValues<StateMap>,
      action: MapValues<ActionMap>,
    ): MapValues<StateMap> => {
      const curStateAsState = curState as unknown as State<string, unknown>;
      const actionAsAction = action as unknown as Action<string, unknown>;

      // If no handler declared for state, state doesn't change.
      if (definition.handlers[curStateAsState.stateName] == null) {
        return curState;
      }

      // If no handler declared for action in given state, state doesn't change.
      const handler = definition.handlers[curStateAsState.stateName];
      if (handler === undefined) {
        return curState;
      }
      // @ts-ignore - Vendor code: Dynamic property access is required for state machine operation
      const nextAction = handler[actionAsAction.actionName];

      return nextAction != null ? nextAction(curState, action) : curState;
    };

    return {
      nextState: nextStateFunction,
    };
  };

  return doneFunc;
};
