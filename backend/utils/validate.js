const Joi = require('joi');

const validateSignup = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must be less than 50 characters long'
    }),
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address'
    }),
    password: Joi.string().min(6).required().messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 6 characters long'
    }),
    company: Joi.string().allow('', null).optional()
  });

  return schema.validate(data);
};

const validateLogin = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Please enter a valid email address'
    }),
    password: Joi.string().required().messages({
      'string.empty': 'Password is required'
    })
  });

  return schema.validate(data);
};

const validateProject = (data) => {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    description: Joi.string().allow('', null).optional(),
    client: Joi.string().allow('', null).optional(),
    location: Joi.string().allow('', null).optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    area: Joi.number().optional()
  });

  return schema.validate(data);
};

const validateObjectId = (id) => {
  // UUID validation - more flexible to handle test UUIDs
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

module.exports = {
  validateSignup,
  validateLogin,
  validateProject,
  validateObjectId
};