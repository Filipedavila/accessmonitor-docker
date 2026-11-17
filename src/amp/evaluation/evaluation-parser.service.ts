import { Injectable } from '@nestjs/common';
import { createEvaluationEntity } from './evaluation-metrics.domain';
import { AuditReport, ConformanceResultToken, ConformanceToken, EvaluationScoring } from './types';
import { EvaluationProcessingResult, processEvaluation } from '@a12e/accessmonitor-rulesets';
import { generateMd5Hash } from '../../common/security';

@Injectable()
export class EvaluationParserService {
  public parseEvaluation(rawReport: any): {
    evaluationReport: AuditReport;
    evaluationData: EvaluationScoring;
  } {
    if (!rawReport || typeof rawReport !== 'object') {
      throw new Error('Invalid evaluation: evaluation payload must be a non-null object.');
    }

    if (!rawReport.system || !rawReport.system.page || !rawReport.system.page.dom) {
      throw new Error(
        `Invalid QualWeb payload structure for job: missing 'system.page.dom'. Raw payload type: ${rawReport.type || 'unknown'}`,
      );
    }

    const evaluationProcessed: EvaluationProcessingResult = processEvaluation(rawReport);
      // clear raw report to free memory
      rawReport.system = null;
      rawReport.metadata = null;
      rawReport.modules = null;

      const hash = generateMd5Hash(evaluationProcessed.metadata.metadata.evaluatedAt);

    const evaluationReport: AuditReport = {
        metadata: evaluationProcessed.metadata.metadata,
        snapshot: {
          html: evaluationProcessed.html.html,
          sizeInBytes: evaluationProcessed.html.pageSize,
          hash,
        },
        telemetry: {
          elementCounters: evaluationProcessed.elementCounters,
          roles: evaluationProcessed.metadata.telemetry.roles,
          tagCounter: evaluationProcessed.metadata.telemetry.tagCounter,
          totalHtmlTags: evaluationProcessed.metadata.telemetry.totalHtmlTags,
        },
        scoring: {
          conform: evaluationProcessed.scoreDetails.conform as ConformanceToken,
          totalTests: evaluationProcessed.scoreDetails.totalTests,
          score: evaluationProcessed.scoreDetails.score,
          rulesOccurrences: evaluationProcessed.rulesOccurrences,
          assertionEvidence: evaluationProcessed.assertionEvidence,
          conformanceResults: evaluationProcessed.conformanceResults as Record<
            string,
            ConformanceResultToken
          >,
        },
    };

    try {
      const evaluationData = createEvaluationEntity(evaluationReport);
      
      return { evaluationReport: evaluationReport, evaluationData };
    } catch (error) {
      throw new Error(
        `Failed to parse evaluation entity: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
  }
}
}
