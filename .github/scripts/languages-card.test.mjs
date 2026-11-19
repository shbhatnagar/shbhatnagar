import {test} from "node:test"
import assert from "node:assert/strict"
import {formatBytes, formatPercent, render} from "./languages-card.mjs"

test("formats sizes like metrics", () => {
  assert.equal(formatBytes(32), "32 bytes")
  assert.equal(formatBytes(52242), "52.2 kB")
  assert.equal(formatBytes(3052215), "3.05 MB")
  assert.equal(formatPercent(0.255432), "25.54%")
  assert.equal(formatPercent(0.000003), "0%")
})

test("renders count, alternating columns and escaped names", () => {
  const svg = render([
    {name: "TypeScript", color: "#3178c6", size: 300},
    {name: "Python", color: "#3572A5", size: 200},
    {name: "C<&>", color: "#555555", size: 100},
  ])
  assert.match(svg, /3 Languages/)
  assert.match(svg, /C&lt;&amp;&gt;/)
  const [, first, second] = svg.match(/<div class="row fill-width"><section>(.*)<\/section><section>(.*)<\/section><\/div>/s)
  assert.ok(first.includes("TypeScript") && first.includes("C&lt;") && !first.includes("Python"))
  assert.ok(second.includes("Python"))
})
