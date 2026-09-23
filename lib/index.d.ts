import z from "@deepseek-ai/schemastery";
//#region src/index.d.ts
declare const name = "dsh-sdd-progress-xc";
declare const inject: string[];
interface Config {
  requirementsRoot: string;
}
declare const Config: z<Config>;
declare function apply(ctx: any, config: Config): void;
//#endregion
export { Config, apply, inject, name };