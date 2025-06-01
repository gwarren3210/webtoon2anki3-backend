
import { api } from "encore.dev/api"

interface PingParams {
  name: string;
}

interface PingResponse {
  message: string;
}

export const ping = api(
  { method: "POST", path: "/hello-name", expose: true },
  async (p: PingParams): Promise<PingResponse> => {
    return { message: `Hello ${p.name}!` };
  }
);