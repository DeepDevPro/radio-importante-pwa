module.exports = {
  env: {
    serviceworker: true,
    browser: true,
    es2021: true
  },
  globals: {
    self: 'readonly',
    caches: 'readonly',
    fetch: 'readonly',
    Request: 'readonly',
    Response: 'readonly',
    URL: 'readonly',
    console: 'readonly'
  },
  rules: {
    'no-restricted-globals': 'off',
    'no-undef': 'off'
  }
};
