export class PresoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresoError';
  }
}

export class ConfigError extends PresoError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ApiError extends PresoError {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ThemeError extends PresoError {
  constructor(message: string) {
    super(message);
    this.name = 'ThemeError';
  }
}

export class StateError extends PresoError {
  constructor(message: string) {
    super(message);
    this.name = 'StateError';
  }
}
