import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidUrlException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'The URL provided is invalid.',
        timestamp: new Date().toISOString(),
      },
      HttpStatus.BAD_REQUEST, 
    );
  }
}