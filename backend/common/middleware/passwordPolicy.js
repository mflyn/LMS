const passwordValidator = require('password-validator');

// 创建密码验证器
const schema = new passwordValidator();

// 添加密码规则
schema
  .is().min(8)                                    // 最小长度8
  .is().max(100)                                 // 最大长度100
  .has().uppercase()                             // 必须包含大写字母
  .has().lowercase()                             // 必须包含小写字母
  .has().digits()                                // 必须包含数字
  .has().symbols()                               // 必须包含特殊字符
  .has().not().spaces()                          // 不能包含空格
  .is().not().oneOf(['Passw0rd', 'Password123']); // 不能使用常见密码

const passwordPolicy = (req, res, next) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      status: 'error',
      message: '密码不能为空'
    });
  }

  const validation = schema.validate(password, { list: true });
  
  if (validation.length > 0) {
    const messages = {
      min: '密码长度至少为8个字符',
      max: '密码长度不能超过100个字符',
      uppercase: '密码必须包含大写字母',
      lowercase: '密码必须包含小写字母',
      digits: '密码必须包含数字',
      symbols: '密码必须包含特殊字符',
      spaces: '密码不能包含空格'
    };

    const errorMessages = validation.map(error => messages[error] || '密码不符合要求');
    
    return res.status(400).json({
      status: 'error',
      message: '密码不符合安全要求',
      details: errorMessages
    });
  }

  next();
};

module.exports = passwordPolicy; 