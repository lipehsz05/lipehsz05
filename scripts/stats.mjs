// Gera dist/stats.svg com dados reais do GitHub (sem dependências).
// Uso: GITHUB_TOKEN=... GITHUB_USER=lipehsz05 node scripts/stats.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const user = process.env.GITHUB_USER || "lipehsz05";
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN ausente");

const query = `
query ($login: String!) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, privacy: PUBLIC, first: 100) {
      totalCount
      nodes { stargazerCount }
    }
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": user },
  body: JSON.stringify({ query, variables: { login: user } }),
});
const json = await res.json();
if (json.errors) throw new Error(JSON.stringify(json.errors));
const u = json.data.user;

const cal = u.contributionsCollection.contributionCalendar;
const days = cal.weeks.flatMap((w) => w.contributionDays);
const stars = u.repositories.nodes.reduce((s, r) => s + r.stargazerCount, 0);

// Sequências (o dia de hoje sem contribuição ainda não quebra a sequência atual)
let longest = 0;
let run = 0;
for (const d of days) {
  run = d.contributionCount > 0 ? run + 1 : 0;
  longest = Math.max(longest, run);
}
let current = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].contributionCount > 0) current++;
  else if (i === days.length - 1) continue;
  else break;
}

// Contribuições por semana (últimas 26)
const weeks = cal.weeks.slice(-26).map((w) => w.contributionDays.reduce((s, d) => s + d.contributionCount, 0));
const maxWeek = Math.max(1, ...weeks);

const fmt = (n) => n.toLocaleString("pt-BR");
const metrics = [
  ["Contribuições (12 meses)", fmt(cal.totalContributions)],
  ["Sequência atual", `${current} ${current === 1 ? "dia" : "dias"}`],
  ["Maior sequência", `${longest} ${longest === 1 ? "dia" : "dias"}`],
  ["Estrelas recebidas", fmt(stars)],
  ["Repositórios públicos", fmt(u.repositories.totalCount)],
  ["Seguidores", fmt(u.followers.totalCount)],
];

const W = 1280;
const H = 340;
const cellW = 200;
const metricSvg = metrics
  .map(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 48 + col * cellW;
    const y = 108 + row * 104;
    return `
    <g>
      <text x="${x}" y="${y}" class="value">${value}</text>
      <text x="${x}" y="${y + 28}" class="label">${label}</text>
    </g>`;
  })
  .join("");

const chartX = 700;
const chartW = 532;
const chartTop = 96;
const chartH = 170;
const barGap = 6;
const barW = (chartW - barGap * (weeks.length - 1)) / weeks.length;
const bars = weeks
  .map((v, i) => {
    const h = Math.max(3, (v / maxWeek) * chartH);
    const x = chartX + i * (barW + barGap);
    const y = chartTop + chartH - h;
    return `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="url(#bar)"><title>${v} contribuições</title></rect>`;
  })
  .join("");

const updated = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t">
  <title id="t">Estatísticas de ${user} no GitHub: ${metrics.map(([l, v]) => `${l}: ${v}`).join("; ")}</title>
  <defs>
    <clipPath id="frame"><rect width="${W}" height="${H}" rx="22"/></clipPath>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#6366F1" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#22D3EE"/>
    </linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="#6366F1" stop-opacity="0.22"/><stop offset="1" stop-color="#6366F1" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" stroke="#f0f6fc" stroke-opacity="0.04"/></pattern>
    <style>
      text { font-family: "Segoe UI", Inter, -apple-system, Helvetica, Arial, sans-serif; }
      .mono { font-family: "JetBrains Mono", "SFMono-Regular", Consolas, Menlo, monospace; }
      .value { font-size: 34px; font-weight: 700; fill: #f1f5f9; letter-spacing: -0.5px; }
      .label { font-size: 14px; fill: #94a3b8; }
      .bar { transition: opacity .2s; }
      .bar:hover { opacity: .8; }
    </style>
  </defs>
  <g clip-path="url(#frame)">
    <rect width="${W}" height="${H}" fill="#0b0d12"/>
    <rect width="${W}" height="${H}" fill="url(#grid)"/>
    <circle cx="160" cy="40" r="360" fill="url(#glow)"/>
    <text x="48" y="54" class="mono" font-size="13" letter-spacing="1.5" fill="#64748b"><tspan fill="#818CF8">●</tspan>  ESTATÍSTICAS NO GITHUB</text>
    <text x="${W - 48}" y="54" class="mono" font-size="12" fill="#475569" text-anchor="end">atualizado em ${updated}</text>
    ${metricSvg}
    <line x1="664" y1="96" x2="664" y2="300" stroke="#f0f6fc" stroke-opacity="0.08"/>
    ${bars}
    <line x1="${chartX}" y1="${chartTop + chartH + 0.5}" x2="${chartX + chartW}" y2="${chartTop + chartH + 0.5}" stroke="#f0f6fc" stroke-opacity="0.1"/>
    <text x="${chartX}" y="${chartTop + chartH + 34}" class="label" font-size="13">Contribuições por semana · últimos 6 meses</text>
    <text x="${chartX + chartW}" y="${chartTop + chartH + 34}" class="label mono" font-size="12" text-anchor="end">pico: ${maxWeek}/semana</text>
  </g>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="21.5" fill="none" stroke="#f0f6fc" stroke-opacity="0.1"/>
</svg>
`;

mkdirSync("dist", { recursive: true });
writeFileSync("dist/stats.svg", svg);
console.log("dist/stats.svg gerado:", Object.fromEntries(metrics));
