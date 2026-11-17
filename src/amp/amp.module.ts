import { Module } from '@nestjs/common';
import { AmpController } from './amp.controller';
import { AmpService } from './amp.service';
import { EVALUATION_ENGINE } from './evaluation/contracts/evaluation-engine.contract';
import { QualWebPuppeteerEngine } from './evaluation/strategies/evaluation-engine-puppeteer.strategy';
import { EvaluationParserService } from './evaluation/evaluation-parser.service';
import { EvaluationPublicService } from './evaluation/evaluation-public.service';
import { EvaluationStreamService } from './evaluation/evaluation-stream.service';
import { EvaluationQueueService } from './evaluation/evaluation-queue.service';

@Module({
  imports: [],
  controllers: [AmpController],
  providers: [
    AmpService,
    {
      provide: EVALUATION_ENGINE,
      useClass: QualWebPuppeteerEngine,
    },
    EvaluationParserService,
    EvaluationPublicService,
    EvaluationQueueService,
    EvaluationStreamService,
  ],
})
export class AmpModule {}
