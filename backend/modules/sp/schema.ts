export const spCaptchaSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    properties: {},
  },
} as const;

export const spLoginSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["password", "captcha", "cdigest"],
    properties: {
      netid: { type: "string", minLength: 1 },
      username: { type: "string", minLength: 1 },
      password: { type: "string", minLength: 1 },
      captcha: { type: "string", minLength: 1 },
      cdigest: { type: "string", minLength: 1 },
    },
    anyOf: [{ required: ["netid"] }, { required: ["username"] }],
  },
} as const;

export const spRefreshSchema = {
  body: {
    type: "object",
    additionalProperties: false,
    required: ["cookies"],
    properties: {
      cookies: {
        type: "object",
        additionalProperties: { type: "string" },
      },
    },
  },
} as const;
