import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
    {
        ignores: [
            'dist',
            'node_modules',
            '.npm-cache',
            'src-tauri',
            'vite.config.ts',
            'vitest.config.ts',
            'vitest.setup.ts',
        ],
    },
    ...tseslint.configs.recommended,
    {
        files: ['src/**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'warn',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
            ],
        },
    },
)
