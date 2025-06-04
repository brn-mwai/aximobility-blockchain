module.exports = {
    semi: true,
    trailingComma: 'es5',
    singleQuote: true,
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    bracketSpacing: true,
    bracketSameLine: false,
    arrowParens: 'avoid',
    endOfLine: 'lf',
    quoteProps: 'as-needed',
    jsxSingleQuote: true,

    // File-specific overrides
    overrides: [
        {
            files: ['*.json', '*.jsonc'],
            options: {
                printWidth: 80,
                tabWidth: 2,
            },
        },
        {
            files: ['*.md', '*.mdx'],
            options: {
                printWidth: 80,
                proseWrap: 'always',
            },
        },
        {
            files: ['*.ts', '*.tsx'],
            options: {
                parser: 'typescript',
            },
        },
    ],
};