import { describe, it, expect, beforeEach } from '@jest/globals';

jest.mock('@a12e/accessmonitor-rulesets', () => ({
  ruleset: {
    rule_warning: {
      result: 'warning',
      type: 'true',
      score: 10,
    },
    rule_type_true: {
      type: 'true',
      elem: 'all',
      test: 'img',
      score: 8,
      trust: '1',
      dis: { '2': 1 },
    },
    rule_type_decr: {
      type: 'decr',
      elem: 'all',
      test: 'errors_count',
      top: 5,
      steps: 2,
      score: 10,
      trust: '1',
      dis: ['0', '2'],
    },
    rule_type_prop: {
      type: 'prop',
      elem: 'total_tags',
      test: 'bad_tags',
      score: 10,
      trust: '1',
      dis: ['0', '3'],
    },
    rule_floor_clamp: {
      type: 'prop',
      elem: 'total_tags',
      test: 'bad_tags_high',
      score: 10,
      trust: '1',
      dis: ['0', '2'],
    },
    rule_conf_a: { level: 'a' },
    rule_conf_aa: { level: 'aa' },
    rule_conf_aaa: { level: 'aaa' },
    rule_conf_invalid_level: { level: 'b' },
    rule_conf_no_level: {},
  },
  testColors: {
    rule_conf_a: 'R',
    rule_conf_aa: 'R',
    rule_conf_aaa: 'Y',
    rule_conf_invalid_level: 'R',
  },
}));


jest.mock('./qualweb', () => ({
  evaluate: jest.fn().mockResolvedValue({}),
}));

jest.mock('@qualweb/core', () => ({}));
jest.mock('@qualweb/locale', () => ({}));
import { calculateConform, generateScore } from './middleware';

describe('Legacy Engine Unit Tests (calculateConform & generateScore)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateConform(results)', () => {
    it('deve formatar como "A@AA@AAA" contabilizando apenas regras com status "R"', () => {
      const results = {
        rule_conf_a: {},
        rule_conf_aa: {},
        rule_conf_aaa: {}, // Cor é 'Y', deve ser ignorado
      };

      const result = calculateConform(results);

      expect(result).toBe('1@1@0');
    });

    it('deve ignorar regras que não existem no ruleset, níveis inválidos ou sem propriedade level', () => {
      const results = {
        rule_unknown: {},
        rule_conf_invalid_level: {},
        rule_conf_no_level: {},
      };

      const result = calculateConform(results);

      expect(result).toBe('0@0@0');
    });

    it('deve retornar "0@0@0" para dicionário de resultados vazio', () => {
      expect(calculateConform({})).toBe('0@0@0');
    });
  });

  describe('generateScore(report)', () => {
    it('deve retornar "NaN" quando todas as regras são avisos ou ausentes (divisão por zero em pon)', () => {
      const report = {
        data: {
          elems: {},
          tot: {
            results: {
              rule_warning: 0,
              non_existing_rule: 0,
            },
          },
        },
      };

      const score = generateScore(report);

      expect(score).toBe('NaN');
    });

    it('deve calcular o score para regra do tipo "true" e mutar o resultado original', () => {
      const report = {
        data: {
          elems: { img: 1 },
          tot: {
            results: { rule_type_true: 0 },
          },
        },
      };

      // rule_type_true:
      // p = 1 * 2 = 2 -> pp = 2 / 5 = 0.4
      // ss = 8 * 0.4 = 3.2
      // Score = (3.2 / 0.4).toFixed(1) = "8.0"
      const score = generateScore(report);

      expect(score).toBe('8.0');
      expect(report.data.tot.results['rule_type_true']).toBe('8@3.2');
    });

    it('deve calcular "decr" aplicando steps e aplicar clamp no limite inferior de 1', () => {
      // Caso 1: Decremento nominal
      // errors = 11 - 5 = 6; minus = Math.round(6 / 2) = 3
      // op = 10 - 3 = 7 -> rr = 7; p = 2 -> pp = 0.4; ss = 7 * 0.4 = 2.8
      const reportDecr = {
        data: {
          elems: { errors_count: 11 },
          tot: {
            results: { rule_type_decr: 0 },
          },
        },
      };

      expect(generateScore(reportDecr)).toBe('7.0');
      expect(reportDecr.data.tot.results['rule_type_decr']).toBe('10@2.8');

      // Caso 2: Clamp inferior (op < 1 ? 1 : op)
      // errors = 50 - 5 = 45; minus = Math.round(45 / 2) = 23
      // op = 10 - 23 = -13 -> rr = 1; ss = 1 * 0.4 = 0.4
      const reportClamp = {
        data: {
          elems: { errors_count: 50 },
          tot: {
            results: { rule_type_decr: 0 },
          },
        },
      };

      expect(generateScore(reportClamp)).toBe('1.0');
      expect(reportClamp.data.tot.results['rule_type_decr']).toBe('10@0.4');
    });

    it('deve calcular "prop" proporcionalmente e aplicar clamp no limite inferior de 1', () => {
      // Caso 1: Cálculo proporcional normal
      // op = 10 - (10 / 100) * 20 = 8 -> rr = 8
      // p = 1 * 3 = 3 -> pp = 0.6; ss = 8 * 0.6 = 4.8
      const reportProp = {
        data: {
          elems: { total_tags: 100, bad_tags: 20 },
          tot: {
            results: { rule_type_prop: 0 },
          },
        },
      };

      expect(generateScore(reportProp)).toBe('8.0');
      expect(reportProp.data.tot.results['rule_type_prop']).toBe('10@4.8');

      // Caso 2: Clamp quando erros excedem a proporção
      // op = 10 - (10 / 10) * 15 = -5 -> rr = 1
      const reportClamp = {
        data: {
          elems: { total_tags: 10, bad_tags_high: 15 },
          tot: {
            results: { rule_floor_clamp: 0 },
          },
        },
      };

      expect(generateScore(reportClamp)).toBe('1.0');
    });

    it('deve ponderar corretamente a média final com múltiplos tipos de regras agregadas', () => {
      const report = {
        data: {
          elems: {
            img: 1,
            errors_count: 11, // rr = 7, ss = 2.8, pp = 0.4
          },
          tot: {
            results: {
              rule_type_true: 0, // rr = 8, ss = 3.2, pp = 0.4
              rule_type_decr: 0,
            },
          },
        },
      };

      // rel = 3.2 + 2.8 = 6.0
      // pon = 0.4 + 0.4 = 0.8
      // score = (6.0 / 0.8).toFixed(1) = "7.5"
      const finalScore = generateScore(report);

      expect(finalScore).toBe('7.5');
      expect(report.data.tot.results['rule_type_true']).toBe('8@3.2');
      expect(report.data.tot.results['rule_type_decr']).toBe('10@2.8');
    });
  });
});