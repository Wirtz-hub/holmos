export class InstagramError extends Error {
  constructor(
    message: string,
    readonly needsReconnect = false,
  ) {
    super(message);
    this.name = "InstagramError";
  }
}
