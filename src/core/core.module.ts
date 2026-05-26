import { Module,Logger } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { GlobalExceptionFilter } from "./filters/all-exceptions.filter";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ResponseTransformInterceptor } from "./interceptors/response.interceptor";

const modules = [

  HealthModule,

];

@Module({
  imports: modules,
  exports: modules,
  providers: [
    Logger,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter, 
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTransformInterceptor,
    },

  ],
})
export class CoreModule {}
