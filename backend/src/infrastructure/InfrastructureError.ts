export class InfrastructureError extends Error {
  readonly type = 'Infrastructure' as const;

  constructor(message: string) {
    super(message);
    this.name = 'InfrastructureError';
  }
}
