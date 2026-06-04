import Fastify from 'fastify';
import type { Repositories } from './types.js';
import { registerErrorHandler } from './error-handler.js';
import { identityRoutes } from './identity/routes.js';
import { catalogueRoutes } from './catalogue/routes.js';
import { expenseRoutes } from './expense/routes.js';
import { budgetRoutes } from './budget/routes.js';

export function buildApp(repos: Repositories) {
  const app = Fastify();
  registerErrorHandler(app);
  app.register(identityRoutes(repos), { prefix: '/api' });
  app.register(catalogueRoutes(repos), { prefix: '/api' });
  app.register(expenseRoutes(repos), { prefix: '/api' });
  app.register(budgetRoutes(repos), { prefix: '/api' });
  return app;
}
