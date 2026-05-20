import { Module } from '@nestjs/common';
import { AmpController } from './amp.controller';
import { AmpService } from './amp.service';

@Module({
  imports: [],
  controllers: [AmpController],
  providers: [AmpService],
})
export class AmpModule {}
