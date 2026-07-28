import { credentialsBodySchema, authBodySchema } from "../../shared/schemas";

export const loginSchema = { body: credentialsBodySchema };
export const refreshSchema = { body: authBodySchema };
