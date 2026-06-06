export class DomainError extends Error {
  readonly type = 'Domain' as const;

  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
