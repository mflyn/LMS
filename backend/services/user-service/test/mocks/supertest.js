/**
 * supertest 模拟模块
 */

const request = (app) => {
  const methods = ['get', 'post', 'put', 'delete', 'patch'];
  
  const createRequest = (method) => {
    return (url) => {
      const req = {
        url,
        method,
        headers: {},
        body: {},
        
        set: function(key, value) {
          if (typeof key === 'object') {
            this.headers = { ...this.headers, ...key };
          } else {
            this.headers[key] = value;
          }
          return this;
        },
        
        send: function(data) {
          this.body = data;
          return this;
        },
        
        query: function(params) {
          this.queryParams = params;
          return this;
        },
        
        expect: function(status) {
          this.expectedStatus = status;
          return this;
        },
        
        then: function(callback) {
          // 模拟响应
          const response = {
            status: this.expectedStatus || 200,
            body: {
              status: this.expectedStatus >= 400 ? 'error' : 'success',
              message: this.expectedStatus >= 400 ? 'Error message' : 'Success message',
              data: {}
            },
            headers: {
              'content-type': 'application/json'
            },
            text: JSON.stringify({
              status: this.expectedStatus >= 400 ? 'error' : 'success',
              message: this.expectedStatus >= 400 ? 'Error message' : 'Success message',
              data: {}
            })
          };
          
          return Promise.resolve(callback(response));
        }
      };
      
      return req;
    };
  };
  
  const requestObj = {};
  methods.forEach(method => {
    requestObj[method] = createRequest(method);
  });
  
  return requestObj;
};

module.exports = request;
