/**
 * multer 模拟模块
 */

const multer = () => {
  const middleware = (req, res, next) => {
    req.file = {
      fieldname: 'file',
      originalname: 'test-file.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      destination: '/tmp/uploads',
      filename: 'test-file-123456.pdf',
      path: '/tmp/uploads/test-file-123456.pdf',
      size: 12345
    };
    next();
  };

  middleware.single = jest.fn().mockReturnValue(middleware);
  middleware.array = jest.fn().mockReturnValue(middleware);
  middleware.fields = jest.fn().mockReturnValue(middleware);
  middleware.none = jest.fn().mockReturnValue(middleware);
  middleware.any = jest.fn().mockReturnValue(middleware);

  return middleware;
};

multer.diskStorage = jest.fn().mockReturnValue({
  destination: jest.fn(),
  filename: jest.fn()
});

multer.memoryStorage = jest.fn().mockReturnValue({});

module.exports = multer;
