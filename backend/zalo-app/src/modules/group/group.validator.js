const Joi = require('joi');

const createGroupSchema = Joi.object({
  members: Joi.array().items(Joi.string()).min(2).required(),
  createdBy: Joi.string().required()
});

const updateGroupSchema = Joi.object({
  name: Joi.string(),
  description: Joi.string().allow(''),
  avatar: Joi.string().allow(''),
}).min(1);

const addMemberSchema = Joi.object({
  userId: Joi.string().required(),
  role: Joi.string().valid('ADMIN', 'DEPUTY', 'MEMBER').default('MEMBER')
});

const updateMemberSchema = Joi.object({
  role: Joi.string().valid('ADMIN', 'DEPUTY', 'MEMBER').required()
});

module.exports = {
  createGroupSchema,
  updateGroupSchema,
  addMemberSchema,
  updateMemberSchema
}; 