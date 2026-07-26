#!/usr/bin/env bash
# Extreme adversarial test suite — 3 rounds
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin:$PATH"
BASE="${1:-https://go.tdtc.indevs.in}"
PASS=0
FAIL=0
log() { echo "$*"; }
ok() { PASS=$((PASS+1)); log "  ✓ $*"; }
bad() { FAIL=$((FAIL+1)); log "  ✗ $*"; }

expect_code() {
  local want="$1" got="$2" name="$3"
  if [[ "$got" == "$want" ]]; then ok "$name → $got"; else bad "$name → got $got want $want"; fi
}
expect_json_field() {
  local file="$1" field="$2" want="$3" name="$4"
  local got
  got=$(python3 -c "import json;d=json.load(open('$file'));print(d.get('$field',''))" 2>/dev/null || echo ERR)
  if [[ "$got" == "$want" ]]; then ok "$name → $want"; else bad "$name → got '$got' want '$want'"; fi
}

round_unauth() {
  log "--- unauth surface ---"
  for ep in /api/auth/me /api/lessons /api/friends /api/stats /api/parent/summary /api/badges /api/settings/ai; do
    code=$(curl -sS -o /tmp/adv.json -w "%{http_code}" "$BASE$ep" || echo 000)
    expect_code 401 "$code" "GET $ep"
  done
  code=$(curl -sS -o /tmp/adv.json -w "%{http_code}" -X POST "$BASE/api/coach" -H 'Content-Type: application/json' -d '{"tone":"hint","locale":"en","childName":"x"}' || echo 000)
  expect_code 401 "$code" "POST coach"
  code=$(curl -sS -o /tmp/adv.json -w "%{http_code}" -X POST "$BASE/api/friends/add" -H 'Content-Type: application/json' -d '{"nickname":"x"}' || echo 000)
  expect_code 401 "$code" "POST friends/add"
  code=$(curl -sS -o /tmp/adv.json -w "%{http_code}" -X POST "$BASE/api/events" -H 'Content-Type: application/json' -d '{"event":"session_start"}' || echo 000)
  expect_code 401 "$code" "POST events"
  code=$(curl -sS -o /tmp/adv.json -w "%{http_code}" -X POST "$BASE/api/progress/L01" -H 'Content-Type: application/json' -d '{"status":"completed","stars":3}' || echo 000)
  expect_code 401 "$code" "POST progress"
  code=$(curl -sS -o /tmp/adv.json -w "%{http_code}" -X POST "$BASE/api/friends/messages" -H 'Content-Type: application/json' -d '{"friendshipId":"x","body":"hi"}' || echo 000)
  expect_code 401 "$code" "POST friends/messages"
}

round_inject() {
  log "--- inject / validation ---"
  curl -sS -o /tmp/adv.json -X POST "$BASE/api/auth/register/quick" -H 'Content-Type: application/json' \
    -d '{"nickname":"<script>x</script>","pin":"1234","locale":"en"}' >/dev/null
  expect_json_field /tmp/adv.json error invalid_input "xss nick"

  curl -sS -o /tmp/adv.json -X POST "$BASE/api/auth/register/quick" -H 'Content-Type: application/json' \
    -d '{"nickname":"ok","pin":"ab12","locale":"en"}' >/dev/null
  expect_json_field /tmp/adv.json error invalid_input "non-digit pin"

  curl -sS -o /tmp/adv.json -X POST "$BASE/api/auth/register/parent" -H 'Content-Type: application/json' \
    -d '{"email":"not-an-email","password":"123456","childNickname":"kidz","locale":"en"}' >/dev/null
  expect_json_field /tmp/adv.json error invalid_input "bad email"

  code=$(curl -sS -o /tmp/adv.json -w "%{http_code}" -X POST "$BASE/api/coach" -H 'Content-Type: application/json' -d 'NOTJSON' || echo 000)
  # unauth first → 401 preferred over invalid_json
  if [[ "$code" == "401" || "$code" == "400" ]]; then ok "bad json coach → $code"; else bad "bad json coach → $code"; fi
}

register_quick() {
  # $1 cookie jar, $2 nick, $3 pin, $4 locale → writes /tmp/adv.json; retries rate_limited
  local jar="$1" nick="$2" pin="$3" loc="$4" i code
  for i in 1 2 3 4 5; do
    code=$(curl -sS -c "$jar" -b "$jar" -o /tmp/adv.json -w "%{http_code}" -X POST "$BASE/api/auth/register/quick" \
      -H 'Content-Type: application/json' \
      -d "{\"nickname\":\"$nick\",\"pin\":\"$pin\",\"locale\":\"$loc\"}" || echo 000)
    if python3 -c "import json;d=json.load(open('/tmp/adv.json'));raise SystemExit(0 if d.get('ok') is True else 1)" 2>/dev/null; then
      return 0
    fi
    err=$(python3 -c "import json;print(json.load(open('/tmp/adv.json')).get('error',''))" 2>/dev/null || true)
    if [[ "$err" == "rate_limited" || "$code" == "429" ]]; then
      log "  … rate limited, sleep ${i}0s"
      sleep $((i * 12))
      continue
    fi
    return 1
  done
  return 1
}

round_auth_flow() {
  log "--- auth / progress / friends ---"
  local ts A B C PIN FID
  ts=$(date +%s | tail -c 6)
  A="a$ts"; B="b$ts"; C="c$ts"; PIN=1357

  if register_quick /tmp/advA "$A" "$PIN" "zh-Hant"; then ok "register A"; else bad "register A"; cat /tmp/adv.json; echo; fi

  if register_quick /tmp/advB "$B" "$PIN" "zh-Hant"; then ok "register B"; else bad "register B"; fi
  if register_quick /tmp/advC "$C" "$PIN" "en"; then ok "register C"; else bad "register C"; fi

  # nick taken
  curl -sS -o /tmp/adv.json -X POST "$BASE/api/auth/register/quick" -H 'Content-Type: application/json' \
    -d "{\"nickname\":\"$A\",\"pin\":\"9999\",\"locale\":\"en\"}" >/dev/null
  expect_json_field /tmp/adv.json error nickname_taken "nick taken"

  # skip lock
  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/progress/L12" -H 'Content-Type: application/json' \
    -d '{"status":"completed","stars":3}' >/dev/null
  expect_json_field /tmp/adv.json error locked "skip L12"

  code=$(curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -w "%{http_code}" "$BASE/api/lessons/L05" || echo 000)
  expect_code 403 "$code" "GET locked L05"

  # complete L01 stars clamp
  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/progress/L01" -H 'Content-Type: application/json' \
    -d '{"status":"completed","stars":99}' >/dev/null
  stars=$(python3 -c "import json;print(json.load(open('/tmp/adv.json')).get('stars'))")
  if [[ "$stars" == "3" ]]; then ok "stars clamp 99→3"; else bad "stars clamp got $stars"; fi

  curl -sS -c /tmp/advA -b /tmp/advA -X POST "$BASE/api/progress/L02" -H 'Content-Type: application/json' \
    -d '{"status":"completed","stars":2}' >/dev/null

  # friends
  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/add" -H 'Content-Type: application/json' \
    -d "{\"nickname\":\"$A\"}" >/dev/null
  expect_json_field /tmp/adv.json error cannot_add_self "add self"

  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/add" -H 'Content-Type: application/json' \
    -d '{"nickname":"no_user_zzzz"}' >/dev/null
  expect_json_field /tmp/adv.json error friend_not_found "add missing"

  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/add" -H 'Content-Type: application/json' \
    -d "{\"nickname\":\"$B\"}" >/dev/null
  FID=$(python3 -c "import json;print(json.load(open('/tmp/adv.json')).get('friendshipId',''))")
  if [[ -n "$FID" ]]; then ok "add B pending id"; else bad "no friendshipId"; fi

  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/messages" -H 'Content-Type: application/json' \
    -d "{\"friendshipId\":\"$FID\",\"body\":\"early\"}" >/dev/null
  expect_json_field /tmp/adv.json error not_friends "msg before accept"

  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/accept" -H 'Content-Type: application/json' \
    -d "{\"friendshipId\":\"$FID\"}" >/dev/null
  expect_json_field /tmp/adv.json error cannot_accept_own "accept own request"

  curl -sS -c /tmp/advB -b /tmp/advB -o /tmp/adv.json -X POST "$BASE/api/friends/add" -H 'Content-Type: application/json' \
    -d "{\"nickname\":\"$A\"}" >/dev/null
  st=$(python3 -c "import json;print(json.load(open('/tmp/adv.json')).get('status'))")
  if [[ "$st" == "accepted" ]]; then ok "mutual accept"; else bad "mutual status=$st"; fi

  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/messages" -H 'Content-Type: application/json' \
    -d "{\"friendshipId\":\"$FID\",\"body\":\"你好呀\"}" >/dev/null
  python3 -c "import json;d=json.load(open('/tmp/adv.json'));assert d.get('ok') is True" && ok "msg ok" || bad "msg ok"

  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/messages" -H 'Content-Type: application/json' \
    -d "{\"friendshipId\":\"$FID\",\"body\":\"https://evil.test\"}" >/dev/null
  expect_json_field /tmp/adv.json error invalid_message "block url"

  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/messages" -H 'Content-Type: application/json' \
    -d "{\"friendshipId\":\"$FID\",\"body\":\"<b>x</b>\"}" >/dev/null
  expect_json_field /tmp/adv.json error invalid_message "block html"

  long=$(python3 -c "print('字'*100)")
  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/messages" -H 'Content-Type: application/json' \
    -d "{\"friendshipId\":\"$FID\",\"body\":\"$long\"}" >/dev/null
  expect_json_field /tmp/adv.json error invalid_message "block long"

  curl -sS -c /tmp/advC -b /tmp/advC -o /tmp/adv.json -X POST "$BASE/api/friends/messages" -H 'Content-Type: application/json' \
    -d "{\"friendshipId\":\"$FID\",\"body\":\"steal\"}" >/dev/null
  expect_json_field /tmp/adv.json error not_friends "third party steal send"

  code=$(curl -sS -c /tmp/advC -b /tmp/advC -o /tmp/adv.json -w "%{http_code}" "$BASE/api/friends/messages?friendshipId=$FID" || echo 000)
  expect_code 403 "$code" "third party steal get"

  # coach as A with huge boardSummary
  huge=$(python3 -c "print('B'*5000)")
  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/coach" -H 'Content-Type: application/json' \
    -d "{\"tone\":\"hint\",\"locale\":\"zh-Hant\",\"lessonId\":\"L99\",\"boardSummary\":\"$huge\"}" >/dev/null
  python3 -c "import json;d=json.load(open('/tmp/adv.json'));assert 'say' in d or d.get('error');print('  ✓ coach responded', d.get('via') or d.get('source') or d.get('error'))" && PASS=$((PASS+1)) || bad "coach"

  curl -sS -o /tmp/adv.json -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"mode\":\"quick\",\"nickname\":\"$A\",\"pin\":\"0000\"}" >/dev/null
  expect_json_field /tmp/adv.json error auth_failed "wrong pin"

  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X PUT "$BASE/api/settings/ai" -H 'Content-Type: application/json' \
    -d '{"provider":"openai_compatible","baseUrl":"http://evil.com","apiKey":"sk"}' >/dev/null
  expect_json_field /tmp/adv.json error base_url_must_https "http byok blocked"

  # remove friend then msg
  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/remove" -H 'Content-Type: application/json' \
    -d "{\"friendshipId\":\"$FID\"}" >/dev/null
  python3 -c "import json;assert json.load(open('/tmp/adv.json')).get('ok') is True" && ok "remove friend" || bad "remove"
  curl -sS -c /tmp/advA -b /tmp/advA -o /tmp/adv.json -X POST "$BASE/api/friends/messages" -H 'Content-Type: application/json' \
    -d "{\"friendshipId\":\"$FID\",\"body\":\"after\"}" >/dev/null
  expect_json_field /tmp/adv.json error not_friends "msg after remove"

  # export for round continuity
  echo "$A $B $C $PIN" > /tmp/adv_users.txt
}

round_headers_health() {
  log "--- health / headers ---"
  curl -sS -o /tmp/adv.json "$BASE/api/health"
  ver=$(python3 -c "import json;print(json.load(open('/tmp/adv.json')).get('version',''))")
  if [[ -n "$ver" ]]; then ok "health version=$ver"; else bad "no version"; fi

  hdrs=$(curl -sSI "$BASE/" | tr -d '\r')
  echo "$hdrs" | grep -qi "content-security-policy" && ok "CSP" || bad "CSP missing"
  echo "$hdrs" | grep -qi "x-frame-options" && ok "X-Frame" || bad "X-Frame missing"
  echo "$hdrs" | grep -qi "x-content-type-options" && ok "nosniff" || bad "nosniff missing"
}

# ─── Rounds ───
for R in 1 2 3; do
  log ""
  log "========== ROUND $R =========="
  round_unauth
  round_inject
  round_auth_flow
  round_headers_health
  log "--- round $R tally so far pass=$PASS fail=$FAIL ---"
  if [[ "$R" -lt 3 ]]; then
    log "… pause 8s between rounds (rate-limit cushion)"
    sleep 8
  fi
done

log ""
log "========== SUMMARY =========="
log "PASS=$PASS FAIL=$FAIL"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
