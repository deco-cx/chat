export class IntegrationNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntegrationNotFoundError";
  }
}

export class AgentNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentNotFoundError";
  }
}

export class TriggerNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TriggerNotFoundError";
  }
}
