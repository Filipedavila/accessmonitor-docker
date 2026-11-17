export class EvaluationTimeoutError extends Error {
  constructor(ms: number) {
    super(`Evaluation exceeded ${ms}ms`);
    this.name = 'EvaluationTimeoutError';
  }
}

export class EvaluationAbortedError extends Error {
  constructor() {
    super('Evaluation aborted by client');
    this.name = 'EvaluationAbortedError';
  }
}
