import { buildApp } from './src/http/app.js';
import { makeRepos } from './src/infrastructure/repositories.js';

const app = buildApp(makeRepos());

app.listen({ port: Number(process.env['PORT']) || 3000, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Server listening at ${address}`);
});
