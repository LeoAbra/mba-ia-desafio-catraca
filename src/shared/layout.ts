import { html, type SafeHtml } from './html.js';
import type { SessionUser } from './types.js';

function nav(user: SessionUser | undefined): SafeHtml {
  if (!user) {
    return html`<a href="/">Vitrine</a> · <a href="/entrar">Entrar</a> · <a href="/cadastro">Criar conta</a>`;
  }
  const area =
    user.role === 'organizer'
      ? html`<a href="/organizador">Meus eventos</a>`
      : html`<a href="/meus-ingressos">Meus ingressos</a>`;
  return html`<a href="/">Vitrine</a> · ${area} · <span class="user">${user.name}</span>
    <form method="post" action="/sair" class="inline"><button type="submit">Sair</button></form>`;
}

export function layout(title: string, user: SessionUser | undefined, body: SafeHtml): string {
  return html`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · Catraca</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 0 auto; padding: 16px; line-height: 1.4; }
  header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-bottom: 16px; gap: 12px; flex-wrap: wrap; }
  .inline { display: inline; }
  .msg { padding: 8px 12px; border-radius: 6px; background: #eef; margin: 12px 0; }
  .erro { background: #fde8e8; }
  .ok { background: #e6f6ea; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border-bottom: 1px solid #eee; padding: 6px 8px; text-align: left; }
  form.stack label { display: block; margin: 8px 0; }
  section { margin: 20px 0; }
</style>
</head>
<body>
<header><strong><a href="/">Catraca</a></strong><nav>${nav(user)}</nav></header>
<main>
<h1>${title}</h1>
${body}
</main>
</body>
</html>`.value;
}

export function message(text: string | undefined, kind: 'erro' | 'ok' | 'info' = 'info'): SafeHtml {
  if (!text) return html``;
  return html`<p class="msg ${kind}" role="status">${text}</p>`;
}
