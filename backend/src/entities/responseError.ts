class ResponseError extends Error {
  status: number;
  code: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.code = status;
    Object.setPrototypeOf(this, ResponseError.prototype);
  }
}

export { ResponseError };
