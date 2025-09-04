module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        // TypeScript specific rules
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-non-null-assertion': 'warn',

        '@typescript-eslint/no-var-requires': 'error',

        // General rules
        'no-console': 'warn',
        'no-debugger': 'error',
        'no-duplicate-imports': 'error',
        'no-unused-expressions': 'error',
        'prefer-const': 'error',
        'no-var': 'error',
        'object-shorthand': 'error',
        'prefer-arrow-callback': 'error',
        'prefer-template': 'error',
        'template-curly-spacing': 'error',
        'arrow-spacing': 'error',
        'comma-dangle': ['error', 'always-multiline'],
        'quotes': ['error', 'single', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'indent': ['error', 2],
        'max-len': ['warn', { code: 120 }],
        'no-trailing-spaces': 'error',
        'eol-last': 'error',
    },
    env: {
        node: true,
        es6: true,
        jest: true,
    },
    ignorePatterns: [
        'dist/',
        'node_modules/',
        '*.js',
        '!.eslintrc.js',
    ],
};