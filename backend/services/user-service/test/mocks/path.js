/**
 * path 模拟模块
 */

const path = {
  join: jest.fn().mockImplementation((...args) => args.join('/')),
  
  resolve: jest.fn().mockImplementation((...args) => args.join('/')),
  
  dirname: jest.fn().mockImplementation((p) => {
    const parts = p.split('/');
    parts.pop();
    return parts.join('/');
  }),
  
  basename: jest.fn().mockImplementation((p, ext) => {
    let base = p.split('/').pop();
    if (ext && base.endsWith(ext)) {
      base = base.substring(0, base.length - ext.length);
    }
    return base;
  }),
  
  extname: jest.fn().mockImplementation((p) => {
    const parts = p.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  }),
  
  parse: jest.fn().mockImplementation((p) => {
    const base = p.split('/').pop();
    const ext = base.includes('.') ? '.' + base.split('.').pop() : '';
    const name = ext ? base.substring(0, base.length - ext.length) : base;
    const dir = p.substring(0, p.length - base.length);
    
    return {
      root: '',
      dir,
      base,
      ext,
      name
    };
  }),
  
  sep: '/',
  delimiter: ':'
};

module.exports = path;
