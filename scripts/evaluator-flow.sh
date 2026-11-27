#!/usr/bin/env bash
# Fluxo do avaliador (brief, passos 2–17) automatizado contra o produto no ar.
# Uso:  ./scripts/evaluator-flow.sh            # passos 2–16 (produto já no ar)
#       ./scripts/evaluator-flow.sh --harness  # + passo 17 (gates, derrubar, subir de novo)
# Variáveis: WEB (padrão http://localhost:3000), API (padrão $WEB), KEY (padrão catraca-parceiro-2026).
# Requer: bash, curl, node (para ler JSON), xargs. Leva ~3 minutos (cartões lentos de 30–40 s).
set -uo pipefail
cd "$(dirname "$0")/.."

WEB="${WEB:-http://localhost:${CATRACA_PORT:-3000}}"
API="${API:-$WEB}"
KEY="${KEY:-catraca-parceiro-2026}"
PASS_SEED="catraca123"
ORG_A="organizador.a@catraca.dev"
ORG_B="organizador.b@catraca.dev"
SEED_P="participante@catraca.dev"
RUN="$(date +%s)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

OK=0
KO=0
step() { printf '\n== Passo %s\n' "$*"; }
pass() { OK=$((OK + 1)); printf '  ✓ %s\n' "$*"; }
fail() { KO=$((KO + 1)); printf '  ✗ %s\n' "$*"; }
check() { # check "descrição" <condição em bash>
  local label="$1"; shift
  if "$@"; then pass "$label"; else fail "$label"; fi
}
eq() { [[ "$1" == "$2" ]] || { printf '      esperado [%s] · observado [%s]\n' "$2" "$1"; return 1; }; }
contains() { grep -qF -- "$2" <<<"$1" || { printf '      [%s] não encontrado\n' "$2"; return 1; }; }
lacks() { ! grep -qF -- "$2" <<<"$1" || { printf '      [%s] encontrado e não deveria\n' "$2"; return 1; }; }

# ---- utilidades -------------------------------------------------------------
js() { node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8'));const v=(${1});process.stdout.write(v===undefined?'':typeof v==='string'?v:JSON.stringify(v))"; }
date_local() { node -e "const d=new Date(Date.now()+($1)*86400000-3*3600000);process.stdout.write(d.toISOString().slice(0,10)+'T${2:-21:00}')"; }
enc() { node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$1"; }

login() { # login <jar> <email> [senha]
  curl -s -o /dev/null -c "$1" -b "$1" --data-urlencode "email=$2" --data-urlencode "password=${3:-$PASS_SEED}" "$WEB/entrar"
}
page() { curl -s -b "$1" "$WEB$2"; }
post_form() { # post_form <jar> <path> <body-urlencoded> → "status|location" e corpo em $TMP/last
  curl -s -o "$TMP/last" -w '%{http_code}|%{redirect_url}' -b "$1" -c "$1" -X POST -H 'Content-Type: application/x-www-form-urlencoded' --data "$3" "$WEB$2"
}
create_event() { # create_event <jar> <nome> <startsAt> <lotação> <preço> → id
  local r
  r=$(post_form "$1" /organizador/eventos "name=$(enc "$2")&startsAt=$3&venue=$(enc 'Bar do Teste')&capacity=$4&price=$(enc "$5")")
  sed -n 's#.*/organizador/eventos/\(evt_[a-z0-9]*\).*#\1#p' <<<"$r"
}
publish() { post_form "$1" "/organizador/eventos/$2/publicar" "" >/dev/null; }
api() { curl -s -w '\n%{http_code}' -H "X-Api-Key: $KEY" "$@"; }
api_buy() { # api_buy <evento> <cartão> [email] → corpo\nstatus
  api -X POST "$API/api/partner/events/$1/purchases" -H 'Content-Type: application/json' \
    -d "{\"buyerEmail\":\"${3:-flow$RUN@example.com}\",\"cardNumber\":\"$2\"}"
}
body() { sed '$d' <<<"$1"; }
code() { tail -n1 <<<"$1"; }
ticket_status() { body "$(api "$API/api/partner/tickets/$1")" | js 'd.status'; }
event_seats() { body "$(api "$API/api/partner/events")" | js "(d.find(e=>e.id==='$1')||{}).availableSeats"; }
listed() { body "$(api "$API/api/partner/events")" | js "d.some(e=>e.id==='$1')"; }
wait_status() { # wait_status <ticket> <status> <segundos>
  local i
  for ((i = 0; i < $3 * 4; i++)); do
    [[ "$(ticket_status "$1")" == "$2" ]] && return 0
    sleep 0.25
  done
  return 1
}
metric() { # metric <jar> <evento> <métrica>
  page "$1" "/organizador/eventos/$2" | tr -d '\n' | sed -n "s#.*data-metric=\"$3\"[^>]*>\([^<]*\)<.*#\1#p"
}
checkin() { # checkin <jar> <evento> <código> → HTML
  post_form "$1" "/organizador/eventos/$2/checkin" "code=$(enc "$3")" >/dev/null
  cat "$TMP/last"
}
sleep_until() { local now; now=$(date +%s); (( $1 > now )) && sleep $(( $1 - now )); return 0; }

A="$TMP/a.jar"; B="$TMP/b.jar"; P="$TMP/p.jar"; S="$TMP/s.jar"
NEXT_MONTH="$(date_local 30)"
YESTERDAY="$(date_local -1)"

echo "Fluxo do avaliador contra WEB=$WEB API=$API (run $RUN)"
check "produto acessível ($WEB/health)" eq "$(curl -s -o /dev/null -w '%{http_code}' "$WEB/health")" 200

# ---- Passo 2 ----------------------------------------------------------------
step "2: E1 em rascunho fora da vitrine e da API"
login "$A" "$ORG_A"
E1_NAME="Jazz no Porao $RUN"
E1=$(create_event "$A" "$E1_NAME" "$NEXT_MONTH" 2 "100,00")
check "E1 criado ($E1)" test -n "$E1"
check "vitrine não mostra E1" lacks "$(curl -s "$WEB/")" "$E1_NAME"
check "API não lista E1" eq "$(listed "$E1")" false

# ---- Passo 3 ----------------------------------------------------------------
step "3: data de ontem rejeitada"
r=$(post_form "$A" /organizador/eventos "name=Ontem$RUN&startsAt=$YESTERDAY&venue=X&capacity=2&price=10")
check "criação com data de ontem → 422" eq "${r%%|*}" 422
check "mensagem de data no futuro" contains "$(cat "$TMP/last")" "A data de início precisa estar no futuro"

# ---- Passo 4 ----------------------------------------------------------------
step "4: publicar E1"
publish "$A" "$E1"
check "vitrine mostra E1" contains "$(curl -s "$WEB/")" "$E1_NAME"
LIST=$(body "$(api "$API/api/partner/events")")
check "API: availableSeats 2" eq "$(js "(d.find(e=>e.id==='$E1')||{}).availableSeats" <<<"$LIST")" 2
check "API: priceCents 10000" eq "$(js "(d.find(e=>e.id==='$E1')||{}).priceCents" <<<"$LIST")" 10000

# ---- Passo 5 ----------------------------------------------------------------
step "5: participante novo compra na vitrine (0001)"
r=$(post_form "$P" /cadastro "name=Participante%20Fluxo&email=fluxo$RUN%40example.com&password=segredo123")
check "cadastro pela UI → 302" eq "${r%%|*}" 302
r=$(post_form "$P" "/eventos/$E1/comprar" "cardNumber=4000000000000001")
check "compra na vitrine → 302" eq "${r%%|*}" 302
check "Meus ingressos: pendente" contains "$(page "$P" /meus-ingressos)" "pendente"
confirmed_c1=false
for _ in $(seq 20); do page "$P" /meus-ingressos | grep -q 'confirmado' && { confirmed_c1=true; break; }; sleep 0.25; done
check "Meus ingressos: confirmado em até 5 s" eq "$confirmed_c1" true
MINE=$(page "$P" /meus-ingressos)
C1=$(sed -n 's#.*<code>\([A-Z0-9]\{8\}\)</code>.*#\1#p' <<<"$MINE" | head -n1)
check "Meus ingressos: evento e código ($C1)" contains "$MINE" "$E1_NAME"

# ---- Passo 6 ----------------------------------------------------------------
step "6: compra pela API com 0004 (lenta, recusa)"
R=$(api_buy "$E1" 4000000000000004 t2@example.com); T6_AT=$(date +%s)
check "202" eq "$(code "$R")" 202
check "status pending" eq "$(body "$R" | js 'd.status')" pending
T2=$(body "$R" | js 'd.ticketId'); C2=$(body "$R" | js 'd.code')
check "availableSeats 0" eq "$(event_seats "$E1")" 0

# ---- Passo 7 ----------------------------------------------------------------
step "7: esgotado antes de 30 s"
R=$(api_buy "$E1" 4000000000000001)
check "API → 409" eq "$(code "$R")" 409
check "API → sold_out" eq "$(body "$R" | js 'd.error')" sold_out
check "vitrine: Ingressos esgotados para o participante" contains "$(page "$P" "/eventos/$E1")" "Ingressos esgotados"
check "ainda dentro de 30 s do passo 6" test $(( $(date +%s) - T6_AT )) -lt 30

# ---- Passo 8 ----------------------------------------------------------------
step "8: após 45 s, T2 recusado e vaga liberada"
sleep_until $((T6_AT + 45))
check "T2 declined" eq "$(ticket_status "$T2")" declined
check "availableSeats 1" eq "$(event_seats "$E1")" 1
R=$(api_buy "$E1" 4000000000000001); T3=$(body "$R" | js 'd.ticketId')
check "T3 → 202" eq "$(code "$R")" 202
check "T3 confirmed em até 5 s" wait_status "$T3" confirmed 5

# ---- Passo 9 ----------------------------------------------------------------
step "9: lotação, preço e painel"
r=$(post_form "$A" "/organizador/eventos/$E1/editar" "name=$(enc "$E1_NAME")&startsAt=$NEXT_MONTH&venue=Bar%20do%20Teste&capacity=1&price=100%2C00")
check "reduzir lotação para 1 → rejeitado" eq "${r%%|*}" 422
r=$(post_form "$A" "/organizador/eventos/$E1/editar" "name=$(enc "$E1_NAME")&startsAt=$NEXT_MONTH&venue=Bar%20do%20Teste&capacity=3&price=150%2C00")
check "preço 150 e lotação 3 → aceito" eq "${r%%|*}" 302
R=$(api_buy "$E1" 4000000000000001); T4=$(body "$R" | js 'd.ticketId')
check "T4 confirmed" wait_status "$T4" confirmed 6
check "painel Confirmados 3" eq "$(metric "$A" "$E1" confirmed)" 3
check "painel Pendentes 0" eq "$(metric "$A" "$E1" pending)" 0
check "painel Check-ins 0" eq "$(metric "$A" "$E1" checkins)" 0
check "painel Vagas 0" eq "$(metric "$A" "$E1" available)" 0
check "painel Receita R\$ 350,00" eq "$(metric "$A" "$E1" revenue)" 'R$ 350,00'
check "painel Estornados 0" eq "$(metric "$A" "$E1" refunded)" 0

# ---- Passo 10 ---------------------------------------------------------------
step "10: check-in"
check "C1 → Entrada liberada" contains "$(checkin "$A" "$E1" "$C1")" "Entrada liberada"
check "C1 de novo → Ingresso já utilizado" contains "$(checkin "$A" "$E1" "$C1")" "Ingresso já utilizado"
check "C2 → Ingresso não confirmado" contains "$(checkin "$A" "$E1" "$C2")" "Ingresso não confirmado"
check "ZZZZZZZZ → Ingresso inválido para este evento" contains "$(checkin "$A" "$E1" ZZZZZZZZ)" "Ingresso inválido para este evento"
check "painel Check-ins 1" eq "$(metric "$A" "$E1" checkins)" 1
MANAGE_E1="/organizador/eventos/$E1"

# ---- Passo 11 ---------------------------------------------------------------
step "11: isolamento entre organizadores e papéis"
login "$B" "$ORG_B"
check "lista de B não mostra E1" lacks "$(page "$B" /organizador)" "$E1_NAME"
check "URL de E1 como B não mostra dados" lacks "$(page "$B" "$MANAGE_E1")" "$E1_NAME"
check "URL de E1 como B não mostra receita" lacks "$(page "$B" "$MANAGE_E1")" "350,00"
E2_NAME="Evento B $RUN"
E2=$(create_event "$B" "$E2_NAME" "$NEXT_MONTH" 1 "20,00"); publish "$B" "$E2"
E2_API=$(body "$(api "$API/api/partner/events")" | js "(d.find(e=>e.name==='$E2_NAME')||{}).id")
check "id de E2 obtido na API" eq "$E2_API" "$E2"
R=$(api_buy "$E2" 4000000000000001); C3=$(body "$R" | js 'd.code')
check "compra de E2 → 202" eq "$(code "$R")" 202
login "$S" "$SEED_P"
check "participante da seed não vê E1 pela URL" lacks "$(page "$S" "$MANAGE_E1")" "$E1_NAME"
check "visitante não vê E1 pela URL" lacks "$(curl -sL "$WEB$MANAGE_E1")" "$E1_NAME"
check "C3 no check-in de E1 → inválido" contains "$(checkin "$A" "$E1" "$C3")" "Ingresso inválido para este evento"

# ---- Passo 12 ---------------------------------------------------------------
step "12: E3 com compra lenta e cancelamento"
E3_NAME="Show Cancelado $RUN"
E3=$(create_event "$A" "$E3_NAME" "$NEXT_MONTH" 5 "50,00"); publish "$A" "$E3"
R=$(api_buy "$E3" 4000000000000003); T5=$(body "$R" | js 'd.ticketId'); T5_AT=$(date +%s)
R=$(api_buy "$E3" 4000000000000001); T6=$(body "$R" | js 'd.ticketId'); C6=$(body "$R" | js 'd.code')
check "T6 confirmed" wait_status "$T6" confirmed 6
r=$(post_form "$A" "/organizador/eventos/$E3/cancelar" "")
check "cancelamento aceito" eq "${r%%|*}" 302
check "cancelado antes de 30 s da T5" test $(( $(date +%s) - T5_AT )) -lt 30

# ---- Passo 13 ---------------------------------------------------------------
step "13: efeitos do cancelamento"
check "E3 fora da vitrine" lacks "$(curl -s "$WEB/")" "$E3_NAME"
check "E3 fora da API" eq "$(listed "$E3")" false
R=$(api_buy "$E3" 4000000000000001)
check "compra de E3 → 404" eq "$(code "$R")" 404
check "compra de E3 → event_not_available" eq "$(body "$R" | js 'd.error')" event_not_available
check "T6 refunded em até 10 s" wait_status "$T6" refunded 10
check "T5 cancelled em até 10 s" wait_status "$T5" cancelled 10
check "página de E3 sem formulário de edição" lacks "$(page "$A" "/organizador/eventos/$E3")" "/organizador/eventos/$E3/editar"

# ---- Passo 14 ---------------------------------------------------------------
step "14: resposta tardia do gateway não muda nada"
sleep_until $((T5_AT + 45))
check "T5 continua cancelled" eq "$(ticket_status "$T5")" cancelled
check "C6 → Evento cancelado" contains "$(checkin "$A" "$E3" "$C6")" "Evento cancelado"
check "painel E3 Confirmados 0" eq "$(metric "$A" "$E3" confirmed)" 0
check "painel E3 Pendentes 0" eq "$(metric "$A" "$E3" pending)" 0
check "painel E3 Check-ins 0" eq "$(metric "$A" "$E3" checkins)" 0
check "painel E3 Vagas 0" eq "$(metric "$A" "$E3" available)" 0
check "painel E3 Receita R\$ 0,00" eq "$(metric "$A" "$E3" revenue)" 'R$ 0,00'
check "painel E3 Estornados 1" eq "$(metric "$A" "$E3" refunded)" 1

# ---- Passo 15 ---------------------------------------------------------------
burst() { # burst <evento> → "N202 N409"
  seq 30 | xargs -P 30 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST "$API/api/partner/events/$1/purchases" \
    -H "X-Api-Key: $KEY" -H "Content-Type: application/json" \
    -d "{\"buyerEmail\":\"carga{}@example.com\",\"cardNumber\":\"4000000000000001\"}" | sort | uniq -c
}
for EV_LABEL in E4 E5; do
  step "15: rajada de 30 compras simultâneas em $EV_LABEL (lotação 5)"
  EV=$(create_event "$A" "Rajada $EV_LABEL $RUN" "$NEXT_MONTH" 5 "10,00"); publish "$A" "$EV"
  OUT=$(burst "$EV"); echo "$OUT" | sed 's/^/      /'
  check "$EV_LABEL: exatamente 5 × 202" eq "$(awk '$2==202{print $1}' <<<"$OUT")" 5
  check "$EV_LABEL: exatamente 25 × 409" eq "$(awk '$2==409{print $1}' <<<"$OUT")" 25
  ok=false
  for _ in $(seq 40); do [[ "$(metric "$A" "$EV" confirmed)" == 5 ]] && { ok=true; break; }; sleep 0.25; done
  check "$EV_LABEL: painel Confirmados 5 em até 10 s" eq "$ok" true
  check "$EV_LABEL: painel Vagas 0" eq "$(metric "$A" "$EV" available)" 0
done

# ---- Passo 16 ---------------------------------------------------------------
step "16: autenticação e erros da API"
for route in "GET $API/api/partner/events" "POST $API/api/partner/events/$E1/purchases" "GET $API/api/partner/tickets/$T3"; do
  m=${route%% *}; u=${route#* }
  for hdr in "" "X-Api-Key: errada"; do
    out=$(curl -s -w '\n%{http_code}' -X "$m" ${hdr:+-H "$hdr"} -H 'Content-Type: application/json' -d '{"buyerEmail":"a@b.co","cardNumber":"4000000000000001"}' "$u")
    check "$m ${u#$API} ${hdr:-sem chave} → 401 unauthorized" eq "$(code "$out")|$(body "$out")" '401|{"error":"unauthorized"}'
  done
done
R=$(api -X POST "$API/api/partner/events/$E1/purchases" -H 'Content-Type: application/json' -d '{"buyerEmail":"a@b.co","cardNumber":"123"}')
check "cardNumber 123 → 422 invalid_request" eq "$(code "$R")|$(body "$R")" '422|{"error":"invalid_request"}'
R=$(api "$API/api/partner/tickets/tkt_inexistente")
check "ticket inexistente → 404 ticket_not_found" eq "$(code "$R")|$(body "$R")" '404|{"error":"ticket_not_found"}'

# ---- Passo 17 ---------------------------------------------------------------
if [[ "${1:-}" == "--harness" ]]; then
  step "17: gates, derrubar e subir de novo"
  check "gates passam" ./scripts/gates.sh
  check "derrubar" ./scripts/down.sh
  check "nenhum contêiner do projeto rodando" eq "$(docker ps -q --filter "label=com.docker.compose.project=${COMPOSE_PROJECT_NAME:-catraca}" | wc -l | tr -d ' ')" 0
  check "porta do produto fechada" test "$(curl -s -o /dev/null -w '%{http_code}' -m 3 "$WEB/health")" = "000"
  check "subir de novo" ./scripts/up.sh
  r=$(curl -s -o /dev/null -w '%{http_code}|%{redirect_url}' --data-urlencode "email=$ORG_A" --data-urlencode "password=$PASS_SEED" "$WEB/entrar")
  check "credencial da seed continua valendo" eq "${r%%|*}" 302
fi

printf '\nResultado: %d ✓ · %d ✗\n' "$OK" "$KO"
[[ "$KO" -eq 0 ]]
