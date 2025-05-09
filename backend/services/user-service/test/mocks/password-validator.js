/**
 * password-validator 模拟模块
 */

class PasswordValidator {
  constructor() {
    this.rules = [];
  }

  is() {
    this.rules.push('is');
    return this;
  }

  min(length) {
    this.rules.push(`min:${length}`);
    return this;
  }

  max(length) {
    this.rules.push(`max:${length}`);
    return this;
  }

  has() {
    this.rules.push('has');
    return this;
  }

  uppercase() {
    this.rules.push('uppercase');
    return this;
  }

  lowercase() {
    this.rules.push('lowercase');
    return this;
  }

  digits() {
    this.rules.push('digits');
    return this;
  }

  symbols() {
    this.rules.push('symbols');
    return this;
  }

  not() {
    this.rules.push('not');
    return this;
  }

  spaces() {
    this.rules.push('spaces');
    return this;
  }

  validate(password, options) {
    // 简单的密码验证逻辑
    if (!password || password.length < 8) {
      return false;
    }
    return true;
  }
}

module.exports = PasswordValidator;
