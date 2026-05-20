import { evaluate } from './qualweb';
const mockQualWebInstance = {
  start: jest.fn(),
  evaluate: jest.fn(),
  stop: jest.fn(),
};

jest.mock('@qualweb/core', () => ({
  QualWeb: jest.fn().mockImplementation(() => mockQualWebInstance),
}));

jest.mock('@qualweb/act-rules', () => ({
  ACTRules: jest.fn().mockImplementation(() => ({ name: 'act-rules' })),
}));

jest.mock('@qualweb/wcag-techniques', () => ({
  WCAGTechniques: jest
    .fn()
    .mockImplementation(() => ({ name: 'wcag-techniques' })),
}));

jest.mock('@qualweb/best-practices', () => ({
  BestPractices: jest
    .fn()
    .mockImplementation(() => ({ name: 'best-practices' })),
}));

jest.mock('@qualweb/counter', () => ({
  Counter: jest.fn().mockImplementation(() => ({ name: 'counter' })),
}));

describe('QualWeb Wrapper - evaluate()', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should initialize options correctly with a single url and return reports', async () => {
    const mockParams = { url: 'https://example.com' };
    const mockExpectedReport = { 'https://example.com': { success: true } };

    mockQualWebInstance.start.mockResolvedValue(undefined);
    mockQualWebInstance.evaluate.mockResolvedValue(mockExpectedReport);
    mockQualWebInstance.stop.mockResolvedValue(undefined);

    const result = await evaluate(mockParams);

    expect(mockQualWebInstance.start).toHaveBeenCalledTimes(1);
    expect(mockQualWebInstance.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com',
        waitUntil: ['load', 'networkidle2'],
      }),
    );
    expect(mockQualWebInstance.stop).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockExpectedReport);
  });

  it('should initialize options correctly with raw html input', async () => {
    const mockParams = { html: '<h1>Test</h1>' };
    const mockExpectedReport = { customHtml: { success: true } };

    mockQualWebInstance.start.mockResolvedValue(undefined);
    mockQualWebInstance.evaluate.mockResolvedValue(mockExpectedReport);

    const result = await evaluate(mockParams);

    expect(mockQualWebInstance.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        html: '<h1>Test</h1>',
      }),
    );
    expect(result).toEqual(mockExpectedReport);
  });
  it('should throw an error immediately if missing input params', async () => {
    const invalidParams = {};

    await expect(evaluate(invalidParams)).rejects.toThrow(
      'Missing input: url, urls or html is required.',
    );

    expect(mockQualWebInstance.start).not.toHaveBeenCalled();

    expect(mockQualWebInstance.stop).toHaveBeenCalledTimes(1);
  });
  it('should throw an error if QualWeb returns empty reports when checking a URL', async () => {
    const mockParams = { url: 'https://dead-site.com' };

    mockQualWebInstance.start.mockResolvedValue(undefined);
    mockQualWebInstance.evaluate.mockResolvedValue({});

    await expect(evaluate(mockParams)).rejects.toThrow(
      'Invalid resource: QualWeb returned an empty report.',
    );

    expect(mockQualWebInstance.stop).toHaveBeenCalledTimes(1);
  });

  it('should log and throw error if qualweb.start or evaluate crashes, but still invoke stop()', async () => {
    const mockParams = { url: 'https://crash.com' };
    const runtimeError = new Error('Puppeteer launch failed');

    mockQualWebInstance.start.mockRejectedValue(runtimeError);

    await expect(evaluate(mockParams)).rejects.toThrow(
      'Puppeteer launch failed',
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[QualWeb Evaluation Failed]: Puppeteer launch failed',
      ),
    );
    expect(mockQualWebInstance.stop).toHaveBeenCalledTimes(1);
  });
});
