import dns from 'node:dns';
import ipRangeCheck from 'ip-range-check';
import { RestrictedNetworkException } from './restricted-network.exception';
import { InvalidUrlException } from './invalid-url.exception';

export async function validateUrlRestriction(url: string, blackList: string[]): Promise<void> {
  let hostname: string;
  let address: string;

  try {
    const parsedUrl = new URL(url);
    hostname = parsedUrl.hostname;
    
    const lookupResult = await dns.promises.lookup(hostname);
    address = lookupResult.address;

    if (!address) {
      throw new Error('No address found'); 
    }
  } catch {
    throw new InvalidUrlException();
  }

  if (ipRangeCheck(address, blackList)) {
    throw new RestrictedNetworkException();
  }
 
}
