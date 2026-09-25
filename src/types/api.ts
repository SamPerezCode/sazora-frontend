export interface ApiSuccess<T> {
  status: "success";
  data: T;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface ApiFailure {
  status: "error";
  code: string;
  message: string;
  errors?: ApiFieldError[];
}
