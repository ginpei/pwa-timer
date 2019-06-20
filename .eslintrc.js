module.exports = {
  env: {
    browser: true,
    es6: true,
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    globalThis: true,
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    "arrow-parens": [
      "error",
      "always",
    ],
    "class-methods-use-this": "off",
    "dot-notation": "off",
    "import/extensions": [
      "error",
      "always",
    ],
    "no-console": [
      "warn",
      {
        allow: ["warn", "error"],
      },
    ],
    "no-underscore-dangle": [
      "error",
      {
        "allowAfterSuper": true,
        "allowAfterThis": true,
      },
    ],
    "space-before-function-paren": [
      "error",
      "always",
    ],
    "spaced-comment": [
      "error",
      "always",
      { "markers": ["/ <reference"] },
    ],
  },
};
