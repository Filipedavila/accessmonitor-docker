import { Module } from '@nestjs/common';
import { AmpController } from './amp.controller';
import { AmpService } from './amp.service';
import { EVALUATION_ENGINE } from './evaluation/contracts/evaluation-engine.contract';
import { QualWebPuppeteerEngine } from './evaluation/strategies/evaluation-engine-puppeteer.strategy';
import { EvaluationParserService } from './evaluation/evaluation-parser.service';
import { EvaluationPublicService } from './evaluation/evaluation-public.service';
import { EvaluationMetricsService } from './evaluation/evaluation-metrics.service';
import { EvaluationAuditService } from './evaluation/evaluation-audit.service';
import { ClickhouseModule } from '../core/clickhouse/clickhouse.module';

@Module({
  imports: [ClickhouseModule],
  controllers: [AmpController],
  providers: [
    AmpService,
    {
      provide: EVALUATION_ENGINE,
      useClass: QualWebPuppeteerEngine,
    },
    EvaluationParserService,
    EvaluationPublicService,
    EvaluationMetricsService,
    EvaluationAuditService,
  ],
})
export class AmpModule {}
