// Renders github-languages.svg (same look as lowlighter/metrics' "most used languages" card)
// from a languages-only GraphQL query.
// ponytail: metrics' base query also counts issues/PRs/deployments per repo; for 67 repos it runs ~10s and GitHub
// 502s it most runs. Its timeout fallback then exits with 0 repos (base/index.mjs: `continue` in do/while with
// pushed=0), and it never pages below 100 per page. This query takes ~3-5s. Ceiling: per-repo `languages(first: 100)`.
import {writeFileSync} from "node:fs"
import {fileURLToPath} from "node:url"

const QUERY = `query($login: String!, $after: String) {
  user(login: $login) {
    repositories(first: 100, after: $after, ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]) {
      pageInfo { hasNextPage endCursor }
      nodes { languages(first: 100) { edges { size node { name color } } } }
    }
  }
}`

async function graphql(token, variables) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {authorization: `bearer ${token}`, "content-type": "application/json"},
      body: JSON.stringify({query: QUERY, variables}),
    })
    const body = response.ok ? await response.json() : null
    if (body && !body.errors) return body.data
    const reason = body ? JSON.stringify(body.errors) : `HTTP ${response.status}`
    if (attempt === 3 || response.ok) throw new Error(`GraphQL failed: ${reason}`)
    console.warn(`attempt ${attempt} failed (${reason}), retrying`)
  }
}

async function fetchLanguageTotals(token, login) {
  const totals = new Map()
  let after = null
  do {
    const {user: {repositories}} = await graphql(token, {login, after})
    for (const {languages} of repositories.nodes)
      for (const {size, node: {name, color}} of languages.edges) {
        const entry = totals.get(name) ?? {name, color: color ?? "#ededed", size: 0}
        entry.size += size
        totals.set(name, entry)
      }
    after = repositories.pageInfo.hasNextPage ? repositories.pageInfo.endCursor : null
  } while (after)
  return [...totals.values()].sort((a, b) => b.size - a.size)
}

const escape = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export function formatBytes(bytes) {
  if (bytes < 1000) return `${bytes} bytes`
  const units = ["kB", "MB", "GB"]
  let value = bytes, unit = -1
  while (value >= 1000 && unit < units.length - 1) value /= 1000, unit++
  return `${Number(value.toPrecision(3))} ${units[unit]}`
}

export const formatPercent = ratio => `${Number((ratio * 100).toFixed(2))}%`

const STYLE = "svg{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji;color:#777;font-size:14px}h2,h3{margin:8px 0 2px;padding:0;color:#0366d6;font-weight:400}h2 svg{fill:currentColor}h2{font-size:16px}h3{font-size:14px}section>.field{margin-left:5px;margin-right:5px}.field{display:flex;align-items:center;margin-bottom:2px;white-space:nowrap}.field svg{margin:0 8px;fill:#959da5;flex-shrink:0}.row{display:flex;flex-wrap:wrap}.row section{flex:1 1 0}.column{display:flex;flex-direction:column;align-items:center}.fill-width{width:100%}svg.bar{margin:4px 0}.field.language{margin:0 8px;flex-grow:0}.field.language.details,.field.language.details small{display:flex;justify-content:space-between}.field.language.details small{color:#666;text-align:right}.field.language.details small>*,.field.language.details>*{flex:1 1 0}.field.language.details small>:not(:last-child){margin-right:6px}"

const LANGUAGES_ICON = "M1.5 2.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v8.5a.25.25 0 01-.25.25h-6.5a.75.75 0 00-.53.22L4.5 14.44v-2.19a.75.75 0 00-.75-.75h-2a.25.25 0 01-.25-.25v-8.5zM1.75 1A1.75 1.75 0 000 2.75v8.5C0 12.216.784 13 1.75 13H3v1.543a1.457 1.457 0 002.487 1.03L8.061 13h6.189A1.75 1.75 0 0016 11.25v-8.5A1.75 1.75 0 0014.25 1H1.75zm5.03 3.47a.75.75 0 010 1.06L5.31 7l1.47 1.47a.75.75 0 01-1.06 1.06l-2-2a.75.75 0 010-1.06l2-2a.75.75 0 011.06 0zm2.44 0a.75.75 0 000 1.06L10.69 7 9.22 8.47a.75.75 0 001.06 1.06l2-2a.75.75 0 000-1.06l-2-2a.75.75 0 00-1.06 0z"

export function render(languages) {
  const total = languages.reduce((sum, {size}) => sum + size, 0)
  let x = 0
  const bar = languages.map(({color, size}) => {
    const width = 460 * size / total
    const rect = `<rect mask="url(#languages-bar)" x="${x}" y="0" width="${width}" height="8" fill="${color}"/>`
    x += width
    return rect
  }).join("")
  const legend = column => languages.filter((_, i) => i % 2 === column).map(({name, color, size}) => `
<div class="field language details"><div class="field"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="${color}" fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8z"/></svg>${escape(name)}</div><small><div>${formatBytes(size)}</div><div>${formatPercent(size / total)}</div></small></div>`).join("")
  const height = 86 + 20 * Math.ceil(languages.length / 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="${height}">
<style>${STYLE}</style>
<foreignObject x="0" y="0" width="100%" height="100%">
<div xmlns="http://www.w3.org/1999/xhtml">
<section><h2 class="field"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill-rule="evenodd" d="${LANGUAGES_ICON}"/></svg>${languages.length} Languages</h2></section>
<section class="column"><h3 class="field">Most used languages</h3>
<svg class="bar" xmlns="http://www.w3.org/2000/svg" width="460" height="8"><mask id="languages-bar"><rect x="0" y="0" width="460" height="8" fill="white" rx="5"/></mask>${bar}</svg>
<div class="row fill-width"><section>${legend(0)}</section><section>${legend(1)}</section></div>
</section>
</div>
</foreignObject>
</svg>
`
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [output = "github-languages.svg"] = process.argv.slice(2)
  const {GH_TOKEN: token, GITHUB_REPOSITORY_OWNER: login} = process.env
  if (!token || !login) throw new Error("GH_TOKEN and GITHUB_REPOSITORY_OWNER are required")
  const languages = await fetchLanguageTotals(token, login)
  // Never overwrite a good card with an empty one.
  if (!languages.length) throw new Error("No languages returned; keeping the existing card")
  writeFileSync(output, render(languages))
  console.log(`Rendered ${languages.length} languages to ${output}`)
}
