import { api } from "encore.dev/api";

interface HelloResponse {
  message: string;
}

/**
 * @encore
 * api public method=GET path=/hello
 */
export const hello = api(
   { method: "GET", path: "/hello", expose: true },
   async () => {
     return { message: `Hello from encore!` };
   }
 );