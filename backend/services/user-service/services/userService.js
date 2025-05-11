// 用户服务
class UserService {
  async createUser(userData) {
    // 实际实现会在这里
    return { id: 'user123', ...userData };
  }

  async login(credentials) {
    // 实际实现会在这里
    return {
      token: 'jwt-token',
      user: { id: 'user123', email: credentials.email }
    };
  }

  async updateUser(userId, userData) {
    // 实际实现会在这里
    return { id: userId, ...userData };
  }

  async getUserById(userId) {
    // 实际实现会在这里
    return { id: userId, name: '测试用户', email: 'test@example.com' };
  }

  async deleteUser(userId) {
    // 实际实现会在这里
    return true;
  }
}

module.exports = new UserService();
