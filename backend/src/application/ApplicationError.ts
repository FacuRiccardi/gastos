export class ApplicationError extends Error {
  readonly type = 'Application' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ApplicationError';
  }
}
