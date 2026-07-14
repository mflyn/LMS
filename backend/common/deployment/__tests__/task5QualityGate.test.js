const path = require('path');

const repositoryRoot = path.resolve(__dirname, '../../../..');

describe('stage 5 static quality gate', () => {
  test('exports an ESLint 9 flat configuration for server and browser code', () => {
    const config = require(path.join(repositoryRoot, 'eslint.config.js'));

    expect(Array.isArray(config)).toBe(true);
    expect(config).toEqual(expect.arrayContaining([
      expect.objectContaining({
        files: expect.arrayContaining(['backend/common/contracts/**/*.js']),
        languageOptions: expect.objectContaining({
          sourceType: 'commonjs'
        })
      }),
      expect.objectContaining({
        files: expect.arrayContaining(['frontend/web/src/**/*.{js,jsx}']),
        languageOptions: expect.objectContaining({
          parserOptions: expect.objectContaining({ ecmaFeatures: { jsx: true } })
        })
      })
    ]));
  });
});
