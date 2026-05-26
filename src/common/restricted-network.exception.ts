import { HttpException, HttpStatus } from '@nestjs/common';

export class RestrictedNetworkException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'The URL points to a restricted or invalid network destination.',
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST, 
    );
  }
}