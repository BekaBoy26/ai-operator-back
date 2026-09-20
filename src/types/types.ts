declare module "express-serve-static-core" {
  interface Request {
    user?: IPayload;
  }
}

export interface IPayload {
  id: number;
  name: string;
  email: string;
  google_id?: string;
}

export interface ILoginBody {
  email: string;
  password: string;
}

