/**
 * fs 模拟模块
 */

const fs = {
  readFileSync: jest.fn().mockImplementation((path, options) => {
    if (path.includes('package.json')) {
      return JSON.stringify({
        name: 'test-app',
        version: '1.0.0'
      });
    }
    return 'mock file content';
  }),
  
  writeFileSync: jest.fn(),
  
  existsSync: jest.fn().mockReturnValue(true),
  
  mkdirSync: jest.fn(),
  
  unlinkSync: jest.fn(),
  
  readdirSync: jest.fn().mockReturnValue(['file1.js', 'file2.js']),
  
  statSync: jest.fn().mockReturnValue({
    isDirectory: jest.fn().mockReturnValue(false),
    isFile: jest.fn().mockReturnValue(true),
    size: 1024,
    mtime: new Date()
  }),
  
  createReadStream: jest.fn().mockReturnValue({
    pipe: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function(event, handler) {
      if (event === 'end') {
        handler();
      }
      return this;
    })
  }),
  
  createWriteStream: jest.fn().mockReturnValue({
    write: jest.fn(),
    end: jest.fn(),
    on: jest.fn().mockImplementation(function(event, handler) {
      if (event === 'finish') {
        handler();
      }
      return this;
    })
  })
};

// 添加 promises API
fs.promises = {
  readFile: jest.fn().mockResolvedValue(Buffer.from('mock file content')),
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readdir: jest.fn().mockResolvedValue(['file1.js', 'file2.js']),
  stat: jest.fn().mockResolvedValue({
    isDirectory: jest.fn().mockReturnValue(false),
    isFile: jest.fn().mockReturnValue(true),
    size: 1024,
    mtime: new Date()
  })
};

module.exports = fs;
