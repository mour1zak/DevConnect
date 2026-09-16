import * as Joi from 'joi'

export const envValidationsSchema = Joi.object({
    NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

    PORT: Joi.number()
    .port()
    .default(3000),

    DATABASE_URL: Joi.string()
        .required(),

    JWT_SECRET: Joi.string()
        .min(16)
        .required(),

    JWT_EXPIRES_IN: Joi.string()
        .default('1h'),
})