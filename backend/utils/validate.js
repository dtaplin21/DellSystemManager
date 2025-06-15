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
    name: Joi.string().min(2).max(100).required().messages({
      'string.empty': 'Project name is required',
      'string.min': 'Project name must be at least 2 characters long',
      'string.max': 'Project name must be less than 100 characters long'
    }),
    description: Joi.string().allow('', null).optional(),
    client: Joi.string().min(2).max(100).required().messages({
      'string.empty': 'Client name is required',
      'string.min': 'Client name must be at least 2 characters long',
      'string.max': 'Client name must be less than 100 characters long'
    }),
    location: Joi.string().min(2).max(200).required().messages({
      'string.empty': 'Location is required',
      'string.min': 'Location must be at least 2 characters long',
      'string.max': 'Location must be less than 200 characters long'
    }),
    startDate: Joi.date().allow('', null).optional(),
    endDate: Joi.date().allow('', null).optional(),
    status: Joi.string().valid('Active', 'Completed', 'On Hold', 'Delayed').default('Active'),
    progress: Joi.number().min(0).max(100).default(0),
    area: Joi.number().allow(null).optional()
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