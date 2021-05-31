module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  parser: '@typescript-eslint/parser',
  plugins: [
    'prettier',
    '@typescript-eslint/eslint-plugin',
    'no-array-sort-mutation',
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: 'tsconfig.test.json'
  },
  env: {
    jest: true,
    es6: true,
    node: true,
    browser: true,
  },
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/camelcase': 'off',
    'no-array-sort-mutation/no-array-sort-mutation': 'error',
    'no-dupe-class-members': 'off',
    '@typescript-eslint/no-dupe-class-members': ['error'],
    '@typescript-eslint/no-floating-promises': ['error'],
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
  },
}
