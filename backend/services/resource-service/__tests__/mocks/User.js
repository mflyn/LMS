// 模拟 User 模型
class User {
  constructor(data) {
    this._id = data._id || Date.now().toString();
    this.username = data.username;
    this.password = data.password;
    this.email = data.email;
    this.role = data.role || 'student';
    this.name = data.name || '';
    this.createdAt = data.createdAt || new Date();
  }

  static users = [];

  static async create(data) {
    const user = new User(data);
    this.users.push(user);
    return user;
  }

  static async findOne(query) {
    return this.users.find(u => 
      (query.username && u.username === query.username) || 
      (query.email && u.email === query.email)
    );
  }

  static async findById(id) {
    return this.users.find(u => u._id === id);
  }
}

module.exports = User;
