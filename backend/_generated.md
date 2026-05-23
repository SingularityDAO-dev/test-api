 The user wants me to implement a `/random` endpoint based on a detailed design document. The design specifies:

1. Node.js 20+, TypeScript 5.x, Express.js 4.x
2. Directory structure with src/api, src/domain, src/types, src/infrastructure
3. Branded type `NormalizedFloat`
4. Crypto-based random generator using `node:crypto` (`randomBytes`)
5. Layered architecture: Handler -> Service -> Generator
6. Error handling with AppError and global middleware
7. Tests with Vitest + supertest
8. README.md and API.md

I need to provide clean, tested TypeScript code implementing all of this. Since I cannot actually create files in a filesystem, I should provide the code in a structured way, clearly indicating file paths and contents.

Let me plan the files:

1. `package.json` - dependencies and scripts
2. `tsconfig.json` - TypeScript config
3. `src/types/index.ts` - Types and interfaces
4. `src/types/errors.ts` - AppError
5. `src/domain/utils/randomGenerator.ts` - Crypto implementation
6. `src/domain/services/randomService.ts` - Business logic
7. `src/api/handlers/randomHandler.ts` - Express handler
8. `src/api/routes.ts` - Route registration
9. `src/infrastructure/config.ts` - Config
10. `src/infrastructure/server.ts` - Server setup and error handling
11. `src/index.ts` - Entry point
12. `tests/unit/randomGenerator.test.ts`
13. `tests/unit/randomService.test.ts`
14. `tests/integration/randomEndpoint.test.ts`
15. `README.md`
16. `API.md`

Key implementation details:
- `NormalizedFloat` branded type: `type NormalizedFloat = number & { __brand: 'NormalizedFloat' }`
- `generateSecureRandom()`: Read 4 bytes from `randomBytes`, convert to UInt32, divide by 2^32. Need to handle this carefully to ensure [0.0, 1.0). `randomBytes(4).readUInt32BE(0) / 2**32` works. Or use `readUInt32LE`. Either is fine as long as it's uniform. Actually, `readUInt32BE` is fine.
- `CryptoRandomGenerator` class implementing `IRandomGenerator`.
- `RandomService` class implementing `IRandomService`.
- `createRandomHandler` factory function.
- Global error handler in `server.ts` that sanitizes errors.
- `createServer()` function that sets up Express app with middleware, routes, and error handler.
- `startServer()` to actually listen.
- Tests:
  - Unit test for generator: check bounds over many iterations.
  - Unit test for service: mock generator, assert response shape.
  - Integration test: use supertest on the express app, check status, content-type, body shape.

Wait, the design says `randomGenerator.ts` is in `src/domain/utils/`. But `randomBytes` is a Node.js infrastructure concern. The design explicitly puts it there and says it's a "Pure crypto generator". I'll follow the design exactly.

Actually, looking at the design doc section 7.1: `src/domain/utils/randomGenerator.ts`. It says "Pure Function / Infrastructure Detail" in the diagram but puts it in domain. I'll follow the design doc's file paths.

For the branded type, TypeScript branding is compile-time only. The function will return `number as NormalizedFloat`.

Error handling:
- The handler should use `try/catch` and pass to `next(err)`.
- Global error handler should check `AppError` vs unknown error.
- If `AppError` and operational, return status code and message.
- If unknown error, return 500 with generic message.
- Stack traces omitted in production.

Config:
- Simple env var parsing. `PORT`.

Server.ts:
- JSON parsing middleware.
- Routes.
- 404 handler? Not explicitly required but good practice. I'll add a simple 404 or just let it fall through to error handler. Actually, Express default 404 is not JSON. I should add a catch-all or handle it. The design says "Global middleware maps them to...". I'll add a global error handler at the end. For 404s, I can add a middleware at the end before error handler that creates a 404 AppError, or just handle it in the error handler if no route matched? Express doesn't call error handler for 404 automatically. I'll add a catch-all route or a 404 middleware. Let's add a simple catch-all: `app.use((req, res, next) => next(new AppError('Not Found', 404)));` Wait, the design only mentions `/random`. But to be clean, I'll add it. Actually, the prompt says "Add a /random endpoint". I'll keep it minimal but robust. I'll add a 404 handler.

Wait, looking at the design doc again, it doesn't explicitly mention 404 handling. I'll stick to what's needed but make sure the global error handler is present.

For tests:
- Vitest configuration. I should include `vitest.config.ts`.
- Integration tests should import `createServer` and use supertest without starting the actual HTTP server (which is the standard way).

Let me draft the code.

`src/types/index.ts`:
```typescript
export type NormalizedFloat = number & { __brand: 'NormalizedFloat' };

export interface RandomResponse {
  random: NormalizedFloat;
}

export interface IRandomGenerator {
  generate(): NormalizedFloat;
}

export interface IRandomService {
  getRandom(): RandomResponse;
}
```

`src/types/errors.ts`:
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}
```

`src/domain/utils/randomGenerator.ts`:
```typescript
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
```

Wait, is `readUInt32BE` uniform enough? Yes, 4 bytes = 32 bits. 2^32 possible values. Dividing by 2^32 gives [0, 1 - 1/2^32], which is within [0.0, 1.0). Perfect.

`src/domain/services/randomService.ts`:
```typescript
import type { IRandomGenerator, IRandomService, RandomResponse } from '../../types/index.js';

export class RandomService implements IRandomService {
  constructor(private readonly generator: IRandomGenerator) {}

  getRandom(): RandomResponse {
    const value = this.generator.generate();
    return { random: value };
  }
}
```

`src/api/handlers/randomHandler.ts`:
```typescript
import type { Request, Response, NextFunction } from 'express';
import type { IRandomService } from '../../types/index.js';

export function createRandomHandler(service: IRandomService) {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = service.getRandom();
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
```

The design shows the handler returning `Promise<void>`. Since `getRandom` is sync, I don't strictly need `async`, but the design signature has it. I'll make it async to match, or just return Promise.resolve implicitly if I use async. Actually, if I use `async`, it returns a Promise. That's fine.

`src/api/routes.ts`:
```typescript
import { Router } from 'express';
import type { IRandomService } from '../types/index.js';
import { createRandomHandler } from './handlers/randomHandler.js';

export function createRouter(service: IRandomService): Router {
  const router = Router();
  router.get('/random', createRandomHandler(service));
  return router;
}
```

`src/infrastructure/config.ts`:
```typescript
export const config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
};
```

`src/infrastructure/server.ts`:
```typescript
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import type { IRandomService } from '../types/index.js';
import { AppError } from '../types/errors.js';
import { createRouter } from '../api/routes.js';
import { config } from './config.js';

export function createServer(service: IRandomService): Express {
  const app = express();

  app.use(express.json());

  app.use(createRouter(service));

  // 404 handler
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new AppError('Not Found', 404));
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        error: err.name,
        message: err.isOperational ? err.message : 'Internal Server Error',
        ...(config.nodeEnv === 'development' && { stack: err.stack }),
      });
      return;
    }

    // Unexpected error
    console.error('Unexpected error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: config.nodeEnv === 'development' ? err.message : 'An unexpected error occurred',
      ...(config.nodeEnv === 'development' && { stack: err.stack }),
    });
  });

  return app;
}

export function startServer(app: Express, port: number): void {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
```

Wait, the design says `createServer(): Express` without args, but we need to inject the service. The design in section 7.4 says `createServer(): Express`. However, to wire up dependencies without a DI container, we need to pass the service in, or instantiate inside. The design mentions "Handler factory enables DI without a full DI container". So I should probably compose in `index.ts` and pass to `createServer`, or `createServer` can take dependencies. I'll make `createServer` accept `service: IRandomService` to keep it testable. Or I can create the service inside `createServer` but that hurts testability. I'll adjust the signature slightly to accept the service, or create an optional config object. I'll pass `service` to be explicit and testable.

Actually, looking at the design doc section 7.4, it says `createServer(): Express`. But in section 10, integration tests likely need to create the server with injected mocks or real services. If `createServer` instantiates concrete classes internally, it's still testable but less flexible. However, to strictly follow the design, maybe I should make `createServer` instantiate the concrete `CryptoRandomGenerator` and `RandomService` inside. But then integration tests test the full stack, which is fine. Unit tests test the components in isolation.

But wait, the design says "Mock IRandomGenerator; assert getRandom() returns shaped RandomResponse" for unit tests. For integration tests, it says "Supertest + Vitest". Integration tests can use the real server with real crypto. That's fine.

However, if I want to test the handler in isolation, the factory `createRandomHandler` already allows that. For integration tests, using the real stack is fine.

So I can make `createServer()` instantiate the concrete implementations. But to keep it cleaner and align with "ports-and-adapters style layering", I'll compose in `index.ts` and pass to `createServer`. The design doc's signature might be a simplification. I'll add the parameter.

Let's refine `src/infrastructure/server.ts`:
```typescript
export function createServer(service: IRandomService): Express {
  ...
}
```

`src/index.ts`:
```typescript
import { CryptoRandomGenerator } from './domain/utils/randomGenerator.js';
import { RandomService } from './domain/services/randomService.js';
import { createServer, startServer } from './infrastructure/server.js';
import { config } from './infrastructure/config.js';

const generator = new CryptoRandomGenerator();
const service = new RandomService(generator);
const app = createServer(service);

startServer(app, config.port);
```

Now tests.

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

`tests/unit/randomGenerator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateSecureRandom, CryptoRandomGenerator } from '../../src/domain/utils/randomGenerator.js';

describe('generateSecureRandom', () => {
  it('returns a value in [0.0, 1.0) over many iterations', () => {
    for (let i = 0; i < 10000; i++) {
      const val = generateSecureRandom();
      expect(val).toBeGreaterThanOrEqual(0.0);
      expect(val).toBeLessThan(1.0);
    }
  });

  it('produces different values across calls (probabilistic)', () => {
    const set = new Set<number>();
    for (let i = 0; i < 100; i++) {
      set.add(generateSecureRandom());
    }
    expect(set.size).toBeGreaterThan(90); // extremely likely
  });
});

describe('CryptoRandomGenerator', () => {
  it('implements IRandomGenerator.generate', () => {
    const gen = new CryptoRandomGenerator();
    const val = gen.generate();
    expect(typeof val).toBe('number');
    expect(val).toBeGreaterThanOrEqual(0.0);
    expect(val).toBeLessThan(1.0);
  });
});
```

`tests/unit/randomService.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { RandomService } from '../../src/domain/services/randomService.js';
import type { IRandomGenerator, NormalizedFloat } from '../../src/types/index.js';

describe('RandomService', () => {
  it('returns a RandomResponse shaped object using the injected generator', () => {
    const mockGenerator: IRandomGenerator = {
      generate: vi.fn(() => 0.1234 as NormalizedFloat),
    };

    const service = new RandomService(mockGenerator);
    const result = service.getRandom();

    expect(mockGenerator.generate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ random: 0.1234 });
  });
});
```

`tests/integration/randomEndpoint.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createServer } from '../../src/infrastructure/server.js';
import { RandomService } from '../../src/domain/services/randomService.js';
import { CryptoRandomGenerator } from '../../src/domain/utils/randomGenerator.js';

describe('GET /random', () => {
  let app: Express;

  beforeAll(() => {
    const generator = new CryptoRandomGenerator();
    const service = new RandomService(generator);
    app = createServer(service);
  });

  it('responds with 200 and a JSON body containing a numeric random field', async () => {
    const res = await request(app)
      .get('/random')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('random');
    expect(typeof res.body.random).toBe('number');
    expect(res.body.random).toBeGreaterThanOrEqual(0.0);
    expect(res.body.random).toBeLessThan(1.0);
  });
});
```

`README.md`:
Should include setup, install, test commands, and curl examples.

`API.md`:
Should include the formal contract.

One thing: The design mentions `src/api/routes.ts` as "Route table". I'll make sure it exports a function or the router. I'll use a function `createRouter` or just export a function that attaches routes. Actually, in `server.ts` I can just import and use. Let's keep it simple.

Also, the design mentions `isOperational` on AppError. In the global error handler, I should probably use `err.isOperational` to decide whether to expose the message. For 404, it's operational. For crypto failures, if any, it would be operational but we don't have explicit crypto error handling because `randomBytes` throws on failure, which would be caught as an unknown error or we could wrap it. I'll keep it simple: `AppError` instances are treated as operational. Unknown errors are sanitized.

Wait, `randomBytes` can throw if the entropy source fails. In `generateSecureRandom`, that throw would bubble up to the handler, which catches it and passes to `next(err)`. The error handler sees it as a generic `Error`, not `AppError`, so it returns 500 with sanitized message. That's acceptable per the design ("unexpected errors are logged server-side but return generic 500 payloads").

However, to be extra clean, I could wrap it in a try/catch inside the generator and throw an AppError, but the design doesn't explicitly require that. The prompt says "Include error handling." The global boundary handles it.

Let's double check the branded type usage. `0.1234 as NormalizedFloat` is a bit of a type lie in tests, but it's standard for branded types in TS. In the generator, we compute the number and cast it.

Package.json scripts:
```json
{
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Need `tsx` for dev or `ts-node`. `tsx` is faster and nicer.

tsconfig.json:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

Wait, tests are outside src. The tsconfig for build should exclude tests. But tests also need to be type-checked. Vitest usually runs through Vite which handles TS transpilation, so a separate tsconfig for tests might not be needed if `tsx` or `vitest` is used. I'll keep `include` for