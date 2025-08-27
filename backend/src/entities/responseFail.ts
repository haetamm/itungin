class ResponseFail<T> {
  code: number;
  status: string;
  message: T;

  constructor(code: number, message: T) {
    this.code = code;
    this.status = 'fail';
    this.message = message;
  }
}

export { ResponseFail };
