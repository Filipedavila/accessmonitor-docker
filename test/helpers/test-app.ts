import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AmpController } from '../../src/amp/amp.controller';
import { AmpService } from '../../src/amp/amp.service';
import { EvaluationQueueService } from '../../src/amp/evaluation/evaluation-queue.service';
import { EvaluationStreamService } from '../../src/amp/evaluation/evaluation-stream.service';
import { EvaluationPublicService } from '../../src/amp/evaluation/evaluation-public.service';
import { FakeEvaluationService } from './fake-evaluation';

export interface TestApp {
  app: INestApplication;
  baseUrl: string;
  fake: FakeEvaluationService;
}

/** Uses real controllers, guards, queue, and SSE; mocks only the QualWeb evaluation. */
export async function createTestApp(maxConcurrency: number): Promise<TestApp> {
  process.env.REFERER = 'http://localhost';
  const fake = new FakeEvaluationService();
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            QUALWEB_MAX_CONCURRENCY: maxConcurrency,
            IP_BLACKLIST_RANGES: '127.0.0.0/8,10.0.0.0/8,169.254.0.0/16,::1',
          }),
        ],
      }),
    ],
    controllers: [AmpController],
    providers: [
      AmpService,
      EvaluationQueueService,
      EvaluationStreamService,
      EvaluationPublicService,
    ],
  })
    .overrideProvider(EvaluationPublicService)
    .useValue(fake)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  await app.listen(0, '127.0.0.1');
  return { app, baseUrl: await app.getUrl(), fake };
}
