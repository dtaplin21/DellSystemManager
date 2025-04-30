const Joi = require('joi');

// Validate UUIDs
function validateObjectId(id) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Validate signup data
function validateSignup(data) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    company: Joi.string().allow('', null),
  });
  
  return schema.validate(data);
}

// Validate login data
function validateLogin(data) {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });
  
  return schema.validate(data);
}

// Validate project data
function validateProject(data) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    description: Joi.string().allow('', null),
    client: Joi.string().min(2).max(255).required(),
    location: Joi.string().allow('', null),
    startDate: Joi.date().required(),
    endDate: Joi.date().allow('', null).greater(Joi.ref('startDate')),
    area: Joi.number().allow(null).min(0),
  });
  
  return schema.validate(data);
}

// Validate QC data
function validateQCData(data) {
  const schema = Joi.object({
    type: Joi.string().valid('destructive', 'trial', 'repair', 'placement', 'seaming').required(),
    panelId: Joi.string().required(),
    date: Joi.date().required(),
    result: Joi.string().valid('pass', 'fail', 'pending').required(),
    technician: Joi.string().allow('', null),
    temperature: Joi.number().allow(null),
    pressure: Joi.number().allow(null),
    speed: Joi.number().allow(null),
    notes: Joi.string().allow('', null),
    projectId: Joi.string(), // Added by the route handler
  });
  
  return schema.validate(data);
}

// Validate document upload
function validateDocumentUpload(data) {
  const schema = Joi.object({
    projectId: Joi.string().required(),
  });
  
  return schema.validate(data);
}

// Validate panel layout
function validatePanelLayout(data) {
  const schema = Joi.object({
    panels: Joi.array().items(
      Joi.object({
        id: Joi.string().required(),
        x: Joi.number().required(),
        y: Joi.number().required(),
        width: Joi.number().min(1).required(),
        height: Joi.number().min(1).required(),
        label: Joi.string().required(),
        color: Joi.string().allow(null),
        qcStatus: Joi.string().allow(null),
      })
    ),
    width: Joi.number().min(1),
    height: Joi.number().min(1),
    scale: Joi.number().min(0.1).max(10),
  });
  
  return schema.validate(data);
}

module.exports = {
  validateObjectId,
  validateSignup,
  validateLogin,
  validateProject,
  validateQCData,
  validateDocumentUpload,
  validatePanelLayout,
};
