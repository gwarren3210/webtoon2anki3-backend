import { Service } from "encore.dev/service";

export default new Service("testPost")

interface TestPostParams {
   name: string;
   value: any;
 }
 
 interface TestPostResponse {
   received: TestPostParams;
   status: string;
 }
 
 /**
  * @encore
  * api public method=POST path=/test-post
  */
 export async function testPost(params: TestPostParams): Promise<TestPostResponse> {
   return {
     received: params,
     status: "Successfully received POST data",
   };
 }
 