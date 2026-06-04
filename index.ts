import fastify from 'fastify';

const server = fastify();

server.get('/ping', async () => {
  return 'pong\n';
});

server.listen({ port: 8080 }, (err, address) => {
  if (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log(`Server listening at ${address}`);
});
