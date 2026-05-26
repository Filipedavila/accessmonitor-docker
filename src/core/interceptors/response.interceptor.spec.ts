import { ExecutionContext, CallHandler, StreamableFile } from '@nestjs/common';
import { ResponseTransformInterceptor } from './response.interceptor';
import { of } from 'rxjs';

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<any>;
  let mockExecutionContext: Partial<ExecutionContext>;
  let mockCallHandler: Partial<CallHandler>;
  let mockResponse: any;

  beforeEach(() => {
    interceptor = new ResponseTransformInterceptor();
    
    mockResponse = {
      headersSent: false,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: jest.fn().mockReturnValue(mockResponse),
      }),
    };
  });

  it('should be defined', () => {
    expect(interceptor).toBeDefined();
  });

  it('should bypass transformation if result is an instance of StreamableFile', (done) => {
    const mockFile = new StreamableFile(Buffer.from('test'));
    mockCallHandler = {
      handle: () => of(mockFile),
    };

    interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler)
      .subscribe({
        next: (result) => {
          expect(result).toBeInstanceOf(StreamableFile);
          expect(result).toBe(mockFile);
          done();
        },
      });
  });

  it('should bypass transformation if headers are already sent', (done) => {
    mockResponse.headersSent = true;
    const rawData = { message: 'Already sent' };
    mockCallHandler = {
      handle: () => of(rawData),
    };

    interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler)
      .subscribe({
        next: (result) => {
          expect(result).toEqual(rawData);
          expect(result.timestamp).toBeUndefined();
          done();
        },
      });
  });

  it('should format correctly when result is primitive or falsy', (done) => {
    const primitiveResult = 'string_data';
    mockCallHandler = {
      handle: () => of(primitiveResult),
    };

    interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler)
      .subscribe({
        next: (result) => {
          expect(result).toHaveProperty('timestamp');
          expect(result.data).toBe(primitiveResult);
          expect(isNaN(Date.parse(result.timestamp))).toBe(false);
          done();
        },
      });
  });

  it('should transform standard object data without pagination', (done) => {
    const plainObject = { id: 1, name: 'NestJS' };
    mockCallHandler = {
      handle: () => of(plainObject),
    };

    interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler)
      .subscribe({
        next: (result) => {
          expect(result).toHaveProperty('timestamp');
          expect(result.data).toEqual(plainObject);
          expect(result.pagination).toBeUndefined();
          done();
        },
      });
  });

  it('should identify paginated data and transform payload structure', (done) => {
    const paginatedInput = {
      data: [{ id: 1 }, { id: 2 }],
      count: 50,
    };
    mockCallHandler = {
      handle: () => of(paginatedInput),
    };

    interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler)
      .subscribe({
        next: (result) => {
          expect(result).toHaveProperty('timestamp');
          expect(result.data).toEqual(paginatedInput.data);
          expect(result.pagination).toEqual({
            total: 50,
          });
          done();
        },
      });
  });
});