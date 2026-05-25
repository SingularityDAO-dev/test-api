 The user wants me to implement server-side logic, database models, and API endpoints for a `/random` endpoint that returns a random number. The context provides a detailed system architecture design using Node.js + TypeScript + Express.

However, the user also mentioned in the system prompt: "Implement server-side logic, database models, and API endpoints. Write clean, tested Python/TypeScript. Prefer explicit over clever. Include error handling."

Wait, there's a conflict here. The context is clearly TypeScript/Node.js/Express, but the system prompt mentions Python/TypeScript. Given the detailed architecture provided in the context is TypeScript/Express, I should follow that. But I should also note that the user mentioned Python/TypeScript - since the design is explicitly TypeScript, I'll implement in TypeScript.

Actually, looking at the context, it says "Target Stack: Node.js + TypeScript + Express (design is portable to FastAPI/Flask/Gin)." But the directory structure and types are all TypeScript. I should implement the full TypeScript solution as designed.

Wait, the prompt says "Write clean, tested Python/TypeScript." This gives me a choice. But since the context is entirely TypeScript, I should probably provide TypeScript. However, to be safe and helpful, maybe I should provide TypeScript since the design is already laid out in TS? Or should I provide both? The user said "Python/TypeScript" which suggests either is acceptable, but given the detailed TS architecture, TS is the natural choice.

Let me implement the full TypeScript/Express solution according to the architecture.

Key components to implement:
1. `src/types/config.ts` - ServerConfig
2. `src/types/api.ts` - Response DTOs
3. `src/types/services.ts` - IRandomService interface
4. `src/services/random.ts` - RandomService implementation
5. `src/routes/health.ts` - HealthController
6. `src/routes/random.ts` - RandomController with explicit 405 handler
7. `src/middleware/error.ts` - GlobalErrorMiddleware
8. `src/middleware/notFound.ts` - 404 catch-all
9. `src/app.ts` - AppFactory (pure composition root)
10. `src/server.ts` - ServerBootstrap
11. `tests/unit/random.service.test.ts` - Unit tests for service
12. `tests/integration/health.test.ts` - Integration tests
13. `tests/integration/random.test.ts` - Integration tests
14. `package.json` - Dependencies
15. `tsconfig.json` - TypeScript config

Wait, the user said "database models" in the system prompt, but this task is a simple /random endpoint that returns a random number. There is no database involved in the architecture design. I should probably mention that no database is needed for this specific endpoint, or if I must include a database model, it would be artificial. However, the system prompt says "Implement server-side logic, database models, and API endpoints." But the context explicitly says "stateless HTTP REST service" and doesn't mention any database. I should follow the context primarily, as it's the specific task. But to satisfy the system prompt, maybe I should acknowledge that no persistence layer is required? Or perhaps I should add a simple in-memory log? No, that violates the design. The design is explicit. I'll follow the design and note that no database is required for this stateless endpoint.

Actually, looking carefully at the system prompt: "You are a senior backend engineer. Implement server-side logic, database models, and API endpoints. Write clean, tested Python/TypeScript. Prefer explicit over clever. Include error handling."

This is a generic system prompt. The user message provides the specific task and design. The specific task and design take precedence. The design has no database. I will implement exactly what the design specifies in TypeScript, and perhaps add a note that this stateless service does not require a database layer.

Let me draft the code:

**src/types/config.ts**
```typescript
export interface ServerConfig {
  port: number;
}
```

**src/types/api.ts**
```typescript
export interface HealthResponse {
  status: "ok";
}

export interface RandomResponse {
  random: number;
}

export interface ErrorResponse {
  error: string;
  statusCode?: number;
}
```

**src/types/services.ts**
```typescript
export interface IRandomService {
  generate(): number;
}
```

**src/services/random.ts**
```typescript
import { IRandomService } from "../types/services";

export class RandomService implements IRandomService {
  generate(): number {
    return Math.random();
  }
}
```

**src/routes/health.ts**
```typescript
import { Router, Request, Response } from "express";
import { HealthResponse } from "../types/api";

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response<HealthResponse>) => {
    res.json({ status: "ok" });
  });

  return router;
}
```

**src/routes/random.ts**
```typescript
import { Router, Request, Response, NextFunction } from "express";
import { IRandomService } from "../types/services";
import { RandomResponse, ErrorResponse } from "../types/api";

export function createRandomRouter(randomService: IRandomService): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response<RandomResponse>) => {
    const value = randomService.generate();
    res.json({ random: value });
  });

  // Explicit 405 handler for non-GET methods
  router.all("/", (_req: Request, res: Response<ErrorResponse>) => {
    res.status(405).json({
      error: "Method Not Allowed",
      statusCode: 405,
    });
  });

  return router;
}
```

Wait, Express routing: if I mount the router at `/random`, and the router has `/` with `router.all`, that should catch it. But actually, if the router is mounted at `/random`, then `router.all("/")` catches all methods on `/random`. But `router.get("/")` is more specific. In Express, specificity matters. Actually, `router.all` matches all HTTP methods at that path. If we define `router.get` first, then `router.all`, Express should match `GET` to the first one and other methods to the second? Let me think. In Express, for the same path, the order matters. `router.get("/", ...)` then `router.all("/", ...)` - for a GET request, it will hit the first handler and if `res.json` is called, it won't reach the second. For POST, it will skip the first (since it's get-specific) and hit the `all`. Yes, that works.

**src/middleware/error.ts**
```typescript
import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../types/api";

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void {
  // Log error for observability (in production, use proper logger)
  console.error("Unhandled error:", err);

  // Don't leak internal error details to client in production
  const statusCode = 500;
  res.status(statusCode).json({
    error: "Internal Server Error",
    statusCode,
  });
}
```

**src/middleware/notFound.ts**
```typescript
import { Request, Response } from "express";
import { ErrorResponse } from "../types/api";

export function notFoundMiddleware(
  _req: Request,
  res: Response<ErrorResponse>
): void {
  res.status(404).json({
    error: "Not Found",
    statusCode: 404,
  });
}
```

**src/app.ts**
```typescript
import express, { Application } from "express";
import { createHealthRouter } from "./routes/health";
import { createRandomRouter } from "./routes/random";
import { errorMiddleware } from "./middleware/error";
import { notFoundMiddleware } from "./middleware/notFound";
import { IRandomService } from "./types/services";

export interface AppDependencies {
  randomService: IRandomService;
}

export function createApp(deps: AppDependencies): Application {
  const app = express();

  // 1. JSON parser / request metadata
  app.use(express.json());

  // 2. Route handlers
  app.use("/health", createHealthRouter());
  app.use("/random", createRandomRouter(deps.randomService));

  // 3. NotFoundMiddleware (terminal middleware for undefined routes)
  app.use(notFoundMiddleware);

  // 4. ErrorMiddleware (must be last)
  app.use(errorMiddleware);

  return app;
}
```

**src/server.ts**
```typescript
import { createApp } from "./app";
import { RandomService } from "./services/random";
import { ServerConfig } from "./types/config";

function getConfigFromEnv(): ServerConfig {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  if (isNaN(port)) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
  return { port };
}

function main(): void {
  const config = getConfigFromEnv();
  const randomService = new RandomService();
  const app = createApp({ randomService });

  app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
  });
}

main();
```

**tests/unit/random.service.test.ts**
Using jest. Need to mock Math.random or test range.
```typescript
import { RandomService } from "../../src/services/random";

describe("RandomService", () => {
  let service: RandomService;

  beforeEach(() => {
    service = new RandomService();
  });

  it("should return a number between 0 (inclusive) and 1 (exclusive)", () => {
    const value = service.generate();
    expect(typeof value).toBe("number");
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(1);
  });

  it("should delegate to Math.random", () => {
    const mathRandomSpy = jest.spyOn(Math, "random").mockReturnValue(0.42);
    const value = service.generate();
    expect(value).toBe(0.42);
    mathRandomSpy.mockRestore();
  });
});
```

**tests/integration/random.test.ts**
Using supertest.
```typescript
import request from "supertest";
import { createApp } from "../../src/app";
import { RandomService } from "../../src/services/random";
import { IRandomService } from "../../src/types/services";

describe("GET /random", () => {
  const mockRandomService: IRandomService = {
    generate: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("should return 200 with a random number", async () => {
    (mockRandomService.generate as jest.Mock).mockReturnValue(0.12345);
    
    const app = createApp({ randomService: mockRandomService });
    const res = await request(app).get("/random");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ random: 0.12345 });
  });

  it("should return 405 for POST", async () => {
    const app = createApp({ randomService: mockRandomService });
    const res = await request(app).post("/random");

    expect(res.status).toBe(405);
    expect(res.body).toEqual({
      error: "Method Not Allowed",
      statusCode: 405,
    });
  });

  it("should return 405 for PUT", async () => {
    const app = createApp({ randomService: mockRandomService });
    const res = await request(app).put("/random");

    expect(res.status).toBe(405);
    expect(res.body).toEqual({
      error: "Method Not Allowed",
      statusCode: 405,
    });
  });
});
```

**tests/integration/health.test.ts**
```typescript
import request from "supertest";
import { createApp } from "../../src/app";
import { RandomService } from "../../src/services/random";

describe("GET /health", () => {
  it("should return 200 ok", async () => {
    const app = createApp({ randomService: new RandomService() });
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
```

**package.json**
```json
{
  "name": "test-api",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts",
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration"
  },
  "dependencies": {
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.4",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

**tsconfig.json**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**jest.config.js**
```javascript
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
};
```

Wait, I need to make sure the `notFoundMiddleware` is correctly typed. In Express, if a middleware doesn't call `next()`, it's fine. The notFoundMiddleware should probably accept `NextFunction` too for completeness, though it's not strictly necessary.

Also, in `random.ts` route, the 405 handler: `router.all("/", ...)` - I should make sure it doesn't interfere. Actually, in Express, `router.all` matches all HTTP methods. But `router.get` is defined first. For a GET request, Express will match the `get` route and execute it. Since we call `res.json`, the response is sent and the `all` route won't be reached. For POST/PUT/etc., the `get` route won't match, so `all` will match. This is correct.

However, there is a subtlety: if we mount the router at `/random`, then requests to `/random/` (trailing slash) might behave differently depending on strict routing, but that's fine.

One more thing: the `RandomResponse` type should be used in the controller. I did that.

Error handling: The service doesn't throw, but if it did, the error middleware would catch it. The architecture mentions deterministic error handling.

Should I include a README? The user asked to implement the logic, models, and endpoints. I'll provide the key files.

Wait, the user said "database models" in the system prompt. The context doesn't mention a database. I should explicitly state that this stateless RNG endpoint requires no persistence layer, so no database models are included. This addresses the system prompt while respecting the specific task context.

Let me double-check the explicit over clever principle. I'm using explicit interfaces, explicit dependency injection via factory functions, explicit 405 handling, explicit middleware ordering. Good.

Let me review the code for any TypeScript issues:

In `src/routes/random.ts`:
```typescript
import { Router, Request, Response } from "express";
import { IRandomService } from "../types/services";
import { RandomResponse, ErrorResponse } from "../types/api";

export function createRandomRouter(randomService: IRandomService): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response<RandomResponse>) => {
    const value = randomService.generate();
    res.json({ random: value });
  });

  router.all("/", (_req: Request, res: Response<ErrorResponse>) => {
    res.status(405).json({
      error: "Method Not Allowed",
      statusCode: 405,
    });
  });

  return router;
}
```
This looks correct.

In `src/middleware/error.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../types/api";

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void {
  console.error("Unhandled error:", err);
  const statusCode = 500;
  res.status(statusCode).json({
    error: "Internal Server Error",
    statusCode,
  });
}
```
Good. The error middleware must have 4 arguments for Express to recognize it as error middleware.

In `src/middleware/notFound.ts`:
```typescript
import { Request, Response, NextFunction } from "express";
import { ErrorResponse } from "../types/api";

export function notFoundMiddleware(
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction
): void {
  res.status(404).json({
    error: "Not Found",
    statusCode: 404,
  });
}
```
Good.

In `src/app.ts`:
```typescript
import express, { Application } from "express";
import { createHealthRouter } from "./routes/health";
import { createRandomRouter } from "./routes/random";
import { errorMiddleware } from "./middleware/error";
import { notFoundMiddleware } from "./middleware/notFound";
import { IRandomService } from "./types/services";

export interface AppDependencies {
  randomService: IRandomService;
}

export function createApp(deps: AppDependencies): Application {
  const app = express();

  app.use(express.json());
  app.use("/health", createHealthRouter());
  app.use("/random", createRandomRouter(deps.randomService));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
```
Good.

In `src/server.ts`:
```typescript
import { createApp } from "./app";
import { RandomService } from "./services/random";
import { ServerConfig } from "./types/config";

function getConfigFromEnv(): ServerConfig {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  if (isNaN(port)) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }
  return { port };
}

function main(): void {
  const config = getConfig