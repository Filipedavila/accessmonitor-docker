export type EvaluationType = 'url' | 'html';
export interface EvaluationEngine {
  evaluate(payload: string, type: EvaluationType): Promise<any>;
}

export const EVALUATION_ENGINE = Symbol('EVALUATION_ENGINE');