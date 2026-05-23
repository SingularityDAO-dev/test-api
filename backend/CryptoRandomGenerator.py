import { randomBytes } from 'node:crypto';
import type { NormalizedFloat, IRandomGenerator } from '../../types/index.js';

export function generateSecureRandom(): NormalizedFloat {
  const buf = randomBytes(4);
  const uint32 = buf.readUInt32BE(0);
  const float = uint32 / 2 ** 32;
  return float as NormalizedFloat;
}

export class CryptoRandomGenerator implements IRandomGenerator {
  generate(): NormalizedFloat {
    return generateSecureRandom();
  }
}