const cookiesSchema = {
  type: "object",
  additionalProperties: { type: "string" },
} as const;

export const credentialsBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["username", "password"],
  properties: {
    username: { type: "string", minLength: 1 },
    password: { type: "string", minLength: 1 },
    cookies: cookiesSchema,
    captcha: { type: "string", minLength: 1 },
    cdigest: { type: "string", minLength: 1 },
  },
} as const;

export const authBodySchema = {
  type: "object",
  additionalProperties: false,
  anyOf: [
    { required: ["cookies"] },
    { required: ["username", "password"] },
  ],
  properties: {
    username: { type: "string", minLength: 1 },
    password: { type: "string", minLength: 1 },
    cookies: cookiesSchema,
    captcha: { type: "string", minLength: 1 },
    cdigest: { type: "string", minLength: 1 },
  },
} as const;

export const authCalendarBodySchema = {
  ...authBodySchema,
  properties: {
    ...authBodySchema.properties,
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
} as const;
