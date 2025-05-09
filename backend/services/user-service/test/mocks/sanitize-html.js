/**
 * sanitize-html 模拟模块
 */

const sanitizeHtml = jest.fn().mockImplementation((html, options) => {
  // 简单地移除一些常见的HTML标签
  if (typeof html !== 'string') {
    return '';
  }
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '');
});

module.exports = sanitizeHtml;
