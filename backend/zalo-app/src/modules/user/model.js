const AWS = require('aws-sdk');
const config = require('../../config/aws');
require('dotenv').config();
// Configure AWS
AWS.config.update({
    accessKeyId: config.awsAccessKeyId,
    secretAccessKey: config.awsSecretAccessKey,
    region: config.awsRegion
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME;

class User {
    static async create(userData) {
        try {
            // Check if phone number already exists
            const existingUser = await this.getByPhone(userData.phone);
            if (existingUser) {
                throw new Error('Số điện thoại đã được đăng ký');
            }

            // Prepare item for DynamoDB
            const item = {
                phone: userData.phone, // Partition key
                name: userData.name,   // Sort key
                password: userData.password,
                isPhoneVerified: userData.isPhoneVerified || false,
                status: userData.status || 'online',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const params = {
                TableName: TABLE_NAME,
                Item: item,
                ConditionExpression: 'attribute_not_exists(phone) AND attribute_not_exists(#name)',
                ExpressionAttributeNames: {
                    '#name': 'name'
                }
            };

            await dynamoDB.put(params).promise();
            return item;
        } catch (error) {
            console.error('Lỗi khi tạo người dùng:', error);
            throw error;
        }
    }

    static async getByPhone(phone) {
        try {
            const params = {
                TableName: TABLE_NAME,
                KeyConditionExpression: 'phone = :phone',
                ExpressionAttributeValues: {
                    ':phone': phone
                }
            };

            const result = await dynamoDB.query(params).promise();
            return result.Items && result.Items.length > 0 ? result.Items[0] : null;
        } catch (error) {
            console.error('Lỗi khi lấy thông tin người dùng:', error);
            throw error;
        }
    }

    static async update(phone, updateData) {
        try {
            // Get current user data
            const currentUser = await this.getByPhone(phone);
            if (!currentUser) {
                throw new Error('Không tìm thấy người dùng');
            }

            // If name is being updated, we need to delete old record and create new one
            if (updateData.name && updateData.name !== currentUser.name) {
                // Delete old record
                await this.delete(phone, currentUser.name);

                // Create new record with updated data
                const newUser = {
                    ...currentUser,
                    ...updateData,
                    updatedAt: new Date().toISOString()
                };

                const createParams = {
                    TableName: TABLE_NAME,
                    Item: newUser
                };

                await dynamoDB.put(createParams).promise();
                return newUser;
            }

            // If name is not being updated, proceed with normal update
            const updateParts = [];
            const expressionAttributeValues = {
                ':updatedAt': new Date().toISOString()
            };
            const expressionAttributeNames = {};
            let hasNamedAttributes = false;

            // Add fields to update
            updateParts.push('updatedAt = :updatedAt');

            if (updateData.status !== undefined) {
                updateParts.push('#userStatus = :userStatus');
                expressionAttributeValues[':userStatus'] = updateData.status;
                expressionAttributeNames['#userStatus'] = 'status';
                hasNamedAttributes = true;
            }
            if (updateData.password !== undefined) {
                updateParts.push('password = :password');
                expressionAttributeValues[':password'] = updateData.password;
            }
            if (updateData.isPhoneVerified !== undefined) {
                updateParts.push('isPhoneVerified = :isPhoneVerified');
                expressionAttributeValues[':isPhoneVerified'] = updateData.isPhoneVerified;
            }
            if (updateData.gender !== undefined) {
                updateParts.push('gender = :gender');
                expressionAttributeValues[':gender'] = updateData.gender;
            }
            if (updateData.dateOfBirth !== undefined) {
                updateParts.push('dateOfBirth = :dateOfBirth');
                expressionAttributeValues[':dateOfBirth'] = updateData.dateOfBirth;
            }
            if (updateData.avatar !== undefined) {
                updateParts.push('avatar = :avatar');
                expressionAttributeValues[':avatar'] = updateData.avatar;
            }

            const params = {
                TableName: TABLE_NAME,
                Key: {
                    phone: phone,
                    name: currentUser.name
                },
                UpdateExpression: 'set ' + updateParts.join(', '),
                ExpressionAttributeValues: expressionAttributeValues,
                ReturnValues: 'ALL_NEW'
            };

            // Only add ExpressionAttributeNames if we have named attributes
            if (hasNamedAttributes) {
                params.ExpressionAttributeNames = expressionAttributeNames;
            }

            console.log('DynamoDB update params:', JSON.stringify(params, null, 2));

            const result = await dynamoDB.update(params).promise();
            return result.Attributes;
        } catch (error) {
            console.error('Lỗi khi cập nhật thông tin người dùng:', error);
            throw error;
        }
    }

    static async delete(phone, name) {
        try {
            const params = {
                TableName: TABLE_NAME,
                Key: {
                    phone: phone,
                    name: name
                }
            };

            await dynamoDB.delete(params).promise();
            return true;
        } catch (error) {
            console.error('Lỗi khi xóa người dùng:', error);
            throw error;
        }
    }

    static async updatePassword(phone, name, hashedPassword) {
        const params = {
            TableName: TABLE_NAME,
            Key: {
                phone: phone,
                name: name
            },
            UpdateExpression: 'set password = :password, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':password': hashedPassword,
                ':updatedAt': new Date().toISOString()
            },
            ReturnValues: 'ALL_NEW'
        };

        try {
            const result = await dynamoDB.update(params).promise();
            return result.Attributes;
        } catch (error) {
            throw error;
        }
    }

    static async searchUsers(searchTerm) {
        const params = {
            TableName: TABLE_NAME,
            FilterExpression: 'contains(#name, :searchTerm) OR contains(phone, :searchTerm)',
            ExpressionAttributeNames: {
                '#name': 'name'
            },
            ExpressionAttributeValues: {
                ':searchTerm': searchTerm
            }
        };

        try {
            const result = await dynamoDB.scan(params).promise();
            return result.Items;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = User; 