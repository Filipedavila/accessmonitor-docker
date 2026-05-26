import { ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { GlobalExceptionFilter } from './all-exceptions.filter'; // Ajusta o path conforme o teu projeto
import { Response, Request } from 'express';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockArgumentsHost: Partial<ArgumentsHost>;
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let mockLogger: Partial<Logger>;

  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
    };

    filter = new GlobalExceptionFilter(mockLogger as Logger);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      url: '/api/v1/resource',
      method: 'POST',
    };

    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse as Response,
        getRequest: () => mockRequest as Request,
      }),
    };

    process.env.NODE_ENV = 'production'; 
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should be defined', () => {
    expect(filter).toBeDefined();
  });

  it('should catch an HttpException with a string response and map fields correctly', () => {
    const status = HttpStatus.NOT_FOUND;
    const message = 'Resource not found';
    const exception = new HttpException(message, status);

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(status);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: status,
      error: 'HttpException', 
      message: message,
      path: '/api/v1/resource',
      timestamp: expect.any(String),
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      '[POST] /api/v1/resource - Status: 404',
      exception.stack
    );
  });

  it('should extract message and error standard properties from NestJS exception objects', () => {
    const status = HttpStatus.BAD_REQUEST;
    const objectResponse = {
      message: 'Validation failed',
      error: 'Bad Request',
    };
    const exception = new HttpException(objectResponse, status);

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(status);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: status,
      error: 'Bad Request',   
      message: 'Validation failed', 
      path: '/api/v1/resource',
      timestamp: expect.any(String),
    });
  });

  it('should handle class-validator array messages seamlessly without flattening', () => {
    const status = HttpStatus.BAD_REQUEST;
    const classValidatorResponse = {
      message: ['email must be an email address', 'password is too short'],
      error: 'Bad Request',
    };
    const exception = new HttpException(classValidatorResponse, status);

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(status);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: status,
      error: 'Bad Request',
      message: classValidatorResponse.message, 
      path: '/api/v1/resource',
      timestamp: expect.any(String),
    });
  });

  it('should catch unhandled native system errors and mask them as 500 Internal Server Error', () => {
    const nativeError = new TypeError('Cannot read properties of undefined (reading "id")');

    filter.catch(nativeError, mockArgumentsHost as ArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error', 
      message: 'Internal server error', 
      path: '/api/v1/resource',
      timestamp: expect.any(String),
    });

        expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String)
        );
  });

  it('should expose the stack trace in the payload ONLY when NODE_ENV is development', () => {
    process.env.NODE_ENV = 'development';
    const exception = new HttpException('Dev Error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const jsonPayload = (mockResponse.json as jest.Mock).mock.calls[0][0];
    
    expect(jsonPayload).toHaveProperty('stack');
    expect(typeof jsonPayload.stack).toBe('string');
  });

  it('should NOT expose the stack trace in production environment', () => {
    process.env.NODE_ENV = 'production';
    const exception = new HttpException('Prod Error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, mockArgumentsHost as ArgumentsHost);

    const jsonPayload = (mockResponse.json as jest.Mock).mock.calls[0][0];
    
    expect(jsonPayload).not.toHaveProperty('stack');
  });
});