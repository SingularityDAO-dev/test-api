import type { IRandomGenerator, IRandomService, RandomResponse } from '../../types/index.js';

export class RandomService implements IRandomService {
  constructor(private readonly generator: IRandomGenerator) {}

  getRandom(): RandomResponse {
    const value = this.generator.generate();
    return { random: value };
  }
}