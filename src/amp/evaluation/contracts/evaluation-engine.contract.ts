export type EvaluationType = 'url' | 'html';

export interface EvaluateOptions {
  /** Cancels the evaluation (closes Chromium immediately). */
  signal?: AbortSignal;
  /** Defensive execution timeout in ms. */
  timeoutMs?: number;
}

export interface EvaluationEngine {
  evaluate(payload: string, type: EvaluationType, options?: EvaluateOptions): Promise<any>;
}

export const EVALUATION_ENGINE = Symbol('EVALUATION_ENGINE');
