const js = require('@eslint/js');
const globals = require('globals');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');

const cleanGlobals = (...sets) => Object.fromEntries(
  sets.flatMap((set) => Object.entries(set).map(([name, value]) => [name.trim(), value]))
);

const sharedRules = {
  ...js.configs.recommended.rules,
  'no-unused-vars': ['error', {
    argsIgnorePattern: '^_',
    caughtErrors: 'none',
    varsIgnorePattern: '^_'
  }]
};

module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/build/**',
      '**/coverage/**',
      '**/dist/**',
      'frontend/mobile/**',
      'frontend/web/src/__tests__/legacy/**'
    ]
  },
  {
    files: ['frontend/web/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: cleanGlobals(globals.browser, globals.jest)
    }
  },
  {
    files: [
      'backend/common/contracts/**/*.js',
      'backend/common/deployment/__tests__/**/*.js',
      'backend/common/repositories/**/*family*.js',
      'backend/common/services/**/*{media,Media,mongoTransaction}*.js',
      'backend/common/utils/**/*{family,Family}*.js',
      'backend/gateway/**/*.js',
      'backend/services/**/*{family,Family,growth,Growth,media,Media,child,Child,notification,Notification,reminder,Reminder}*.js',
      'backend/services/{user,homework,resource}-service/{app,server}.js',
      'scripts/**/*.js',
      'eslint.config.js',
      'playwright.config.js',
      'test-mock.js'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: cleanGlobals(globals.node, globals.jest)
    },
    rules: sharedRules
  },
  {
    files: [
      'frontend/web/src/{App,index,setupTests}.js',
      'frontend/web/src/components/{child,family}/**/*.{js,jsx}',
      'frontend/web/src/contexts/{AuthContext,ChildAuthContext,FamilyContext}.js',
      'frontend/web/src/hooks/{useAsyncResource,useChildDataResource,useChildResource}.js',
      'frontend/web/src/pages/{child,family}/**/*.{js,jsx}',
      'frontend/web/src/services/{childApi,childScope,childSession,familyApi,familySession}.js',
      'frontend/web/src/__tests__/{child,family,shared}/**/*.{js,jsx}'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: cleanGlobals(globals.browser, globals.jest)
    },
    plugins: {
      react,
      'react-hooks': reactHooks
    },
    settings: {
      react: { version: 'detect' }
    },
    rules: {
      ...sharedRules,
      'react/jsx-uses-react': 'error',
      'react/jsx-uses-vars': 'error',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error'
    }
  }
];
