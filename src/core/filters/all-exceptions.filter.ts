import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch() 
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>(); 

    const status = 
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = 
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status}`, 
      exception instanceof Error ? exception.stack : String(exception)
    );

    let clientMessage: any = exceptionResponse;
    let errorType = 'Internal Server Error';

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      clientMessage = (exceptionResponse as any).message || exceptionResponse;
      errorType = (exceptionResponse as any).error || 'HttpException';
    } else if (exception instanceof HttpException) {
      errorType = exception.name; 
    }

 
    response.status(status).json({
      statusCode: status,
      error: errorType,              
      message: clientMessage,         
      path: request.url, 
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === 'development' && { 
        stack: exception instanceof Error ? exception.stack : String(exception) 
      }),
    });
  }
}