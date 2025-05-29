import { registerGateways, registerHandlers, run, type Handler } from "encore.dev/internal/codegen/appinit";


const gateways: any[] = [
];

const handlers: Handler[] = [
];

registerGateways(gateways);
registerHandlers(handlers);

await run(import.meta.url);
