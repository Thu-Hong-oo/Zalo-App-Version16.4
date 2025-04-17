const Joi = require('joi');
const { MEMBER_ROLES } = require('./groupMemberService');

const createGroupSchema = Joi.object({
  name: Joi.string().required().min(1).max(100),
  description: Joi.string().allow('').max(500),
  createdBy: Joi.string().required()
});

const updateGroupSchema = Joi.object({
  name: Joi.string().min(1).max(100),
  description: Joi.string().allow('').max(500)
}).min(1);

const addMemberSchema = Joi.object({
  groupId: Joi.string().required(),
  userId: Joi.string().required(),
  role: Joi.string().valid(...Object.values(MEMBER_ROLES)),
  addedBy: Joi.string().required(),
  nickname: Joi.string().allow('').max(50)
});

const updateMemberSchema = Joi.object({
  role: Joi.string().valid(...Object.values(MEMBER_ROLES)),
  nickname: Joi.string().allow('').max(50)
}).min(1);

module.exports = {
  createGroupSchema,
  updateGroupSchema,
  addMemberSchema,
  updateMemberSchema
}; 