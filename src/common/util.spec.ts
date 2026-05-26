import { validateUrlRestriction } from './util'; 
import dns from 'node:dns';
import { InvalidUrlException } from './invalid-url.exception';
import { RestrictedNetworkException } from './restricted-network.exception';

jest.mock('node:dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

const mockedDnsLookup = jest.mocked(dns.promises.lookup);

describe('isUrlRestricted', () => {
  const mockBlacklist = ['127.0.0.0/8', '10.0.0.0/8'];

  beforeEach(() => {
    jest.clearAllMocks(); 
  });

  it('should not throw when the resolved IP is public and not in the blacklist', async () => {
    mockedDnsLookup.mockResolvedValue({ address: '8.8.8.8', family: 4 });

    const promise = validateUrlRestriction('https://google.com/search', mockBlacklist);
    
    expect(mockedDnsLookup).toHaveBeenCalledWith('google.com');

    await expect(promise).resolves.not.toThrow();
  });

  it('should throw RestrictedNetworkException when the resolved IP is within the blacklisted range', async () => {
    mockedDnsLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });

    const promise = validateUrlRestriction('http://localhost:8080/admin', mockBlacklist);

    expect(mockedDnsLookup).toHaveBeenCalledWith('localhost');

    await expect(promise).rejects.toThrow(RestrictedNetworkException);
  });

  it('should throw InvalidUrlException when dns.promises.lookup fails', async () => {
    mockedDnsLookup.mockRejectedValue(new Error('ENOTFOUND'));

    const promise = validateUrlRestriction('https://invalid-domain-name-xxx.com', mockBlacklist);
    
    await expect(promise).rejects.toThrow(InvalidUrlException);
  });

  it('should throw InvalidUrlException when URL is completely invalid', async () => {
    const promise = validateUrlRestriction('not-a-valid-url', mockBlacklist);
    
    await expect(promise).rejects.toThrow(InvalidUrlException);
    expect(mockedDnsLookup).not.toHaveBeenCalled();
  });
});