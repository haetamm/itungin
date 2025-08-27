class ResponseSuccess<T> {
  code: number;
  status: string;
  data: T;

  constructor(code: number, data: T) {
    this.code = code;
    this.status = 'success';
    this.data = data;
  }
}

export { ResponseSuccess };
