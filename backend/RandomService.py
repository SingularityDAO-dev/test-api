import { IRandomService } from "../types/services";

export class RandomService implements IRandomService {
  generate(): number {
    return Math.random();
  }
}