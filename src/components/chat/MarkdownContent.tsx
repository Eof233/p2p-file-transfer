import React from 'react'
import { toast } from '../../services/toastService'
import { useI18n } from '../../hooks/useI18n'

/**
 * Lightweight, dependency-free Markdown renderer for chat message text.
 *
 * Supports: fenced code blocks (```lang), bold (**text**), italic (*text*),
 * inline code (`code`), links ([label](url)) and line breaks.
 *
 * Everything is built from React elements (never dangerouslySetInnerHTML):
 * React escapes all text content, so a literal `<script>` in a message
 * renders as plain text. Link targets are additionally whitelisted to
 * http(s)/mailto so a crafted `javascript:` URL can never become a clickable
 * anchor.
 */

// --- Fenced code blocks -----------------------------------------------------

interface CodeBlockProps {
    code: string
    language: string
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
    const { t } = useI18n()

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code)
            toast({ title: t.copied, variant: 'success' })
        } catch {
            // Clipboard unavailable (e.g. non-secure context); ignore silently.
        }
    }

    return (
        <div className="my-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--separator)] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--separator)]">
                {language && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                        {language}
                    </span>
                )}
                <button
                    type="button"
                    onClick={handleCopy}
                    className="ml-auto text-[10px] font-medium text-[var(--accent)] hover:underline"
                >
                    {t.copyCode}
                </button>
            </div>
            <pre className="overflow-x-auto p-3 text-xs leading-relaxed font-mono text-[var(--text-primary)]">
                <code>{highlightCode(code, language)}</code>
            </pre>
        </div>
    )
}

// --- Regex-based syntax highlighting (js/ts/json/css/bash only) -------------

type HighlightType = 'comment' | 'string' | 'keyword' | 'number'

interface HighlightRule {
    source: string
    type: HighlightType
}

interface LangConfig {
    keywords: string[]
    comment?: string
}

const JS_TS_KEYWORDS = [
    'abstract', 'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const',
    'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum',
    'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'get', 'if',
    'implements', 'import', 'in', 'instanceof', 'interface', 'keyof', 'let',
    'namespace', 'new', 'null', 'of', 'private', 'protected', 'public', 'readonly',
    'return', 'satisfies', 'set', 'static', 'super', 'switch', 'this', 'throw',
    'true', 'try', 'type', 'typeof', 'undefined', 'var', 'void', 'while', 'yield',
]

const CSS_KEYWORDS = [
    'align-items', 'align-self', 'animation', 'background', 'background-color',
    'border', 'border-bottom', 'border-left', 'border-radius', 'border-right',
    'border-top', 'bottom', 'box-shadow', 'box-sizing', 'color', 'content',
    'cursor', 'display', 'filter', 'flex', 'flex-direction', 'flex-wrap', 'float',
    'font', 'font-family', 'font-size', 'font-style', 'font-weight', 'gap', 'grid',
    'height', 'justify-content', 'left', 'line-height', 'margin', 'margin-bottom',
    'margin-left', 'margin-right', 'margin-top', 'max-height', 'max-width',
    'min-height', 'min-width', 'opacity', 'overflow', 'padding', 'padding-bottom',
    'padding-left', 'padding-right', 'padding-top', 'position', 'right',
    'text-align', 'text-decoration', 'text-overflow', 'text-shadow', 'top',
    'transform', 'transition', 'vertical-align', 'visibility', 'white-space',
    'width', 'z-index',
]

const BASH_KEYWORDS = [
    'case', 'cd', 'do', 'done', 'echo', 'elif', 'else', 'esac', 'exit', 'export',
    'fi', 'for', 'function', 'if', 'in', 'local', 'return', 'then', 'until', 'while',
]

const LANG_CONFIGS: Record<string, LangConfig> = {
    js: { keywords: JS_TS_KEYWORDS, comment: '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/' },
    ts: { keywords: JS_TS_KEYWORDS, comment: '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/' },
    json: { keywords: ['true', 'false', 'null'] },
    css: { keywords: CSS_KEYWORDS, comment: '\\/\\*[\\s\\S]*?\\*\\/' },
    bash: { keywords: BASH_KEYWORDS, comment: '#[^\\n]*' },
}

// Colors come from the theme CSS variables so they work in both light/dark modes.
const TYPE_CLASS: Record<HighlightType, string> = {
    comment: 'text-[var(--text-tertiary)] italic',
    string: 'text-[var(--success)]',
    keyword: 'text-[var(--accent)]',
    number: 'text-[var(--warning)]',
}

const escapeRegex = (value: string): string =>
    value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const ruleCache: Record<string, HighlightRule[]> = {}
const regexCache: Record<string, RegExp> = {}

const getHighlightRules = (language: string): HighlightRule[] | null => {
    const config = LANG_CONFIGS[language]
    if (!config) return null
    if (!ruleCache[language]) {
        const rules: HighlightRule[] = []
        if (config.comment) rules.push({ source: config.comment, type: 'comment' })
        rules.push({ source: '"(?:\\\\.|[^"\\\\])*"', type: 'string' })
        rules.push({ source: "'(?:\\\\.|[^'\\\\])*'", type: 'string' })
        rules.push({ source: '`(?:\\\\.|[^`\\\\])*`', type: 'string' })
        const keywords = [...config.keywords].sort((a, b) => b.length - a.length)
        if (keywords.length > 0) {
            rules.push({ source: `\\b(?:${keywords.map(escapeRegex).join('|')})\\b`, type: 'keyword' })
        }
        rules.push({ source: '\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b', type: 'number' })
        ruleCache[language] = rules
    }
    return ruleCache[language]
}

/** Tokenize code into colored spans; unknown languages render as plain text. */
const highlightCode = (code: string, language: string): React.ReactNode[] => {
    const rules = getHighlightRules(language)
    if (!rules) return [code]

    const cacheKey = rules.map((rule) => rule.source).join('|')
    let regex = regexCache[cacheKey]
    if (!regex) {
        regex = new RegExp(rules.map((rule) => `(${rule.source})`).join('|'), 'g')
        regexCache[cacheKey] = regex
    }

    regex.lastIndex = 0
    const nodes: React.ReactNode[] = []
    let lastIndex = 0
    let key = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(code)) !== null) {
        if (match.index > lastIndex) nodes.push(code.slice(lastIndex, match.index))
        let type: HighlightType = 'number'
        for (let i = 0; i < rules.length; i++) {
            if (match[i + 1] !== undefined) {
                type = rules[i].type
                break
            }
        }
        nodes.push(
            <span key={key++} className={TYPE_CLASS[type]}>
                {match[0]}
            </span>
        )
        lastIndex = regex.lastIndex
        if (match[0].length === 0) regex.lastIndex++
    }
    if (lastIndex < code.length) nodes.push(code.slice(lastIndex))
    return nodes
}

// --- Inline parsing (bold, italic, inline code, links, line breaks) ---------

const INLINE_TOKEN =
    /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\s][^*\n]*\*)|(\[([^\]]+)\]\(([^)\s]+)\))|\n/g

const isSafeUrl = (url: string): boolean => {
    // Only http(s) and mailto targets become anchors; anything else
    // (javascript:, data:, ...) renders as plain text.
    return /^(https?:|mailto:)/i.test(url.trim())
}

const renderInline = (text: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = []
    let lastIndex = 0
    let key = 0
    INLINE_TOKEN.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = INLINE_TOKEN.exec(text)) !== null) {
        if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
        if (match[1] !== undefined) {
            nodes.push(
                <code
                    key={key++}
                    className="px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-secondary)] font-mono text-[0.9em]"
                >
                    {match[1].slice(1, -1)}
                </code>
            )
        } else if (match[2] !== undefined) {
            nodes.push(<strong key={key++} className="font-semibold">{match[2].slice(2, -2)}</strong>)
        } else if (match[3] !== undefined) {
            nodes.push(<em key={key++} className="italic">{match[3].slice(1, -1)}</em>)
        } else if (match[4] !== undefined) {
            const label = match[5] ?? ''
            const url = match[6] ?? ''
            if (isSafeUrl(url)) {
                nodes.push(
                    <a
                        key={key++}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:opacity-80"
                    >
                        {label}
                    </a>
                )
            } else {
                nodes.push(`[${label}](${url})`)
            }
        } else if (match[0] === '\n') {
            nodes.push(<br key={key++} />)
        }
        lastIndex = INLINE_TOKEN.lastIndex
        if (match[0].length === 0) INLINE_TOKEN.lastIndex++
    }
    if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
    return nodes
}

// --- Block parsing (fenced code blocks vs. text runs) -----------------------

const FENCE_OPEN = /^```([\w+-]*)[ \t]*$/
const FENCE_CLOSE = /^```[ \t]*$/

const renderBlocks = (content: string): React.ReactNode[] => {
    // Normalize Windows line endings so fences pasted from other apps parse.
    const lines = content.replace(/\r\n/g, '\n').split('\n')
    const nodes: React.ReactNode[] = []
    let textLines: string[] = []
    let key = 0

    const flushText = (): void => {
        if (textLines.length === 0) return
        nodes.push(
            <p key={key++} className="text-sm break-words">
                {renderInline(textLines.join('\n'))}
            </p>
        )
        textLines = []
    }

    let i = 0
    while (i < lines.length) {
        const open = lines[i].match(FENCE_OPEN)
        if (open) {
            flushText()
            const language = (open[1] || '').toLowerCase()
            const codeLines: string[] = []
            i++
            while (i < lines.length && !FENCE_CLOSE.test(lines[i])) {
                codeLines.push(lines[i])
                i++
            }
            i++ // skip the closing fence (or move past the end)
            nodes.push(<CodeBlock key={key++} code={codeLines.join('\n')} language={language} />)
        } else {
            textLines.push(lines[i])
            i++
        }
    }
    flushText()
    return nodes
}

export const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
    if (!content) return null
    return <>{renderBlocks(content)}</>
}
