import { QualWeb, QualwebOptions, PuppeteerFingerprintDriver } from '@qualweb/core';
import { Injectable } from '@nestjs/common';
import { ACTRules } from '@qualweb/act-rules';
import { WCAGTechniques } from '@qualweb/wcag-techniques';
import { BestPractices } from '@qualweb/best-practices';
import { Counter } from '@qualweb/counter';
import { z } from 'zod';
import { EvaluationEngine, EvaluationType } from '../contracts/evaluation-engine.contract';
import { createLogger } from 'winston';

const driver = new PuppeteerFingerprintDriver({
  useCluster: false,
  launchOptions: { headless: true, args: ['--disable-blink-features=AutomationControlled'] },
});
const QUALWEB_START_TIMEOUT = 60_000;

const USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36';
const LANGUAGE = 'pt-pt,pt';

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--no-first-run',
  '--disable-blink-features=AutomationControlled',
  '--disable-extensions',
  '--no-zygote',
  '--js-flags=--max-old-space-size=512',
  `--user-agent=${USER_AGENT}`,
  `--lang=${LANGUAGE}`,
];

const UrlSchema = z
  .string()
  .url()
  .refine(
    (val) => {
      try {
        const parsed = new URL(val);
        const host = parsed.hostname.toLowerCase();
        return !['localhost', '127.0.0.1', '169.254.169.254', '0.0.0.0'].includes(host);
      } catch {
        return false;
      }
    },
    { message: 'URL resolve para um endereço restrito ou inválido (SSRF Protection).' },
  );

const normalizeUrl = (s: string) => s.replace(/\/$/, '');

@Injectable()
export class QualWebPuppeteerEngine implements EvaluationEngine {
  private readonly logger = createLogger({ defaultMeta: { service: QualWebPuppeteerEngine.name } });

  private createModules(): any[] {
    return [
      new ACTRules({ exclude: [] }),
      new WCAGTechniques(),
      new BestPractices(),
      new Counter(),
    ];
  }

  private createEvaluationOptions(payload: string, type: EvaluationType): QualwebOptions {
    return {
      modules: this.createModules(),
      waitUntil: ['load', 'networkidle2'],
      log: { file: false },
      ...(type === 'url' ? { url: payload } : { html: payload }),
    };
  }

  /** Só valida (SSRF/formato) quando é URL; para HTML devolve o payload tal como está. */
  private resolveTarget(payload: string, type: EvaluationType): string {
    if (type !== 'url') {
      if (!payload || !payload.trim()) {
        throw new Error('Invalid evaluation parameter: HTML payload is empty.');
      }
      return payload;
    }

    const parseResult = UrlSchema.safeParse(payload);
    if (!parseResult.success) {
      throw new Error(
        `Invalid evaluation parameter: URL must be a valid format. Details: ${parseResult.error.message}`,
      );
    }
    return parseResult.data;
  }

  private validateReports(reports: any | null | undefined, label: string): void {
    if (!reports || typeof reports !== 'object') {
      throw new Error('Invalid report: QualWeb returned null or invalid data.');
    }

    if (Object.keys(reports).length === 0) {
      throw new Error(`Invalid resource: QualWeb returned an empty report for ${label}`);
    }
  }

  private pickReport(reports: Record<string, any>, target: string, type: EvaluationType): any {
    const keys = Object.keys(reports);

    if (type === 'url') {
      const key = keys.find((k) => normalizeUrl(k) === normalizeUrl(target)) ?? keys[0];
      return reports[key];
    }

    // HTML: a chave não é o payload (no QualWeb costuma ser 'customHtml'); fallback para a primeira
    return reports['customHtml'] ?? reports[keys[0]];
  }

  public async evaluate(payload: string, type: EvaluationType): Promise<any> {
    const target = this.resolveTarget(payload, type);
    // Evita escrever o HTML inteiro em logs/erros
    const label = type === 'url' ? `URL ${target}` : '[HTML Payload]';

    const qualweb = new QualWeb(undefined, driver);

    try {
      await qualweb.start(
        {
          maxConcurrency: 1,
          timeout: QUALWEB_START_TIMEOUT,
        },
        {
          headless: true,
          args: BROWSER_ARGS,
        },
      );

      const options = this.createEvaluationOptions(target, type);
      const reports = await qualweb.evaluate(options);

      this.validateReports(reports, label);

      const evaluationReport = this.pickReport(reports, target, type);

      if (!evaluationReport) {
        throw new Error(`QualWeb evaluation output missing report payload for ${label}`);
      }

      return evaluationReport;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`QualWeb evaluation failed for ${label}: ${errorMsg}`);
      throw new Error(`QualWeb evaluation failed: ${errorMsg}`, { cause: error });
    } finally {
      await qualweb.stop().catch((cleanupError) => {
        const cleanupMsg =
          cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
        this.logger.warn(`Failed to cleanly stop QualWeb for ${label}: ${cleanupMsg}`);
      });
    }
  }
}