#!/usr/bin/env bash
set -euo pipefail

BASE="${1:-http://localhost:8787}"
SMOKE_DIR="$(mktemp -d)"
COOKIE_JAR="$SMOKE_DIR/cookies.txt"
PARENT_COOKIE_JAR="$SMOKE_DIR/parent-cookies.txt"
BODY_FILE="$SMOKE_DIR/body.json"
trap 'rm -rf "$SMOKE_DIR"' EXIT
PASS=0
FAIL=0

expect_code() {
  local want="$1" got="$2" label="$3"
  if [[ "$got" == "$want" ]]; then
    PASS=$((PASS + 1))
    echo "✓ $label"
  else
    FAIL=$((FAIL + 1))
    echo "✗ $label (got $got, want $want)"
  fi
}

expect_field() {
  local field="$1" want="$2" label="$3" got
  got=$(python3 -c "import json; print(json.load(open('$BODY_FILE')).get('$field', ''))" 2>/dev/null || true)
  if [[ "$got" == "$want" ]]; then
    PASS=$((PASS + 1))
    echo "✓ $label"
  else
    FAIL=$((FAIL + 1))
    echo "✗ $label (got '$got', want '$want')"
  fi
}

code=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" "$BASE/api/health")
expect_code 200 "$code" "health endpoint"
expect_field ok True "health reports ok"

code=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" "$BASE/api/lessons")
expect_code 401 "$code" "lessons require login"

code=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -X POST "$BASE/api/auth/register/quick" \
  -H "Origin: https://evil.example" -H "Content-Type: application/json" \
  -d '{"nickname":"blocked","pin":"1234","locale":"en"}')
expect_code 403 "$code" "cross-origin mutation is blocked"
expect_field error forbidden_origin "cross-origin error is explicit"

code=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -X POST "$BASE/api/auth/register/quick" \
  -H "Content-Type: application/json" -d 'not-json')
expect_code 400 "$code" "malformed registration JSON"
expect_field error invalid_json "malformed JSON error is explicit"

nickname="smk$(date +%s | tail -c 8)"
code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" \
  -X POST "$BASE/api/auth/register/quick" -H "Content-Type: application/json" \
  -d "{\"nickname\":\"$nickname\",\"pin\":\"246810\",\"locale\":\"zh-Hant\"}")
expect_code 200 "$code" "quick registration"
expect_field ok True "quick registration succeeds"

code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" "$BASE/api/auth/me")
expect_code 200 "$code" "session cookie works"

code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" \
  -X POST "$BASE/api/progress/L01" -H "Content-Type: application/json" \
  -d '{"status":"hacked","stars":3}')
expect_code 400 "$code" "invalid lesson state is rejected"

code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" \
  -X POST "$BASE/api/games" -H "Content-Type: application/json" \
  -d '{"boardSize":19,"aiLevel":99,"moves":"not-an-array"}')
expect_code 400 "$code" "invalid game record is rejected"

code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" \
  -X PUT "$BASE/api/settings/ai" -H "Content-Type: application/json" \
  -d '{"provider":"openai_compatible","baseUrl":"https://127.0.0.1/v1","apiKey":"test"}')
expect_code 403 "$code" "quick account cannot manage AI keys"
expect_field error parent_required "quick AI settings error is explicit"

parent_nick="par$(date +%s | tail -c 8)"
parent_email="$parent_nick@example.test"
parent_password="smoke-pass-123"
code=$(curl -sS -c "$PARENT_COOKIE_JAR" -b "$PARENT_COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" \
  -X POST "$BASE/api/auth/register/parent" -H "Content-Type: application/json" \
  -d "{\"email\":\"$parent_email\",\"password\":\"$parent_password\",\"childNickname\":\"$parent_nick\",\"locale\":\"en\"}")
expect_code 200 "$code" "parent registration"

code=$(curl -sS -c "$PARENT_COOKIE_JAR" -b "$PARENT_COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" \
  -X PUT "$BASE/api/settings/ai" -H "Content-Type: application/json" \
  -d '{"provider":"openai_compatible","baseUrl":"https://127.0.0.1/v1","apiKey":"test","parentPassword":"wrong"}')
expect_code 403 "$code" "AI settings require parent password"
expect_field error parent_verification_required "parent verification error is explicit"

code=$(curl -sS -c "$PARENT_COOKIE_JAR" -b "$PARENT_COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" \
  -X PUT "$BASE/api/settings/ai" -H "Content-Type: application/json" \
  -d "{\"provider\":\"openai_compatible\",\"baseUrl\":\"https://127.0.0.1/v1\",\"apiKey\":\"test\",\"parentPassword\":\"$parent_password\"}")
expect_code 400 "$code" "private AI endpoint is rejected"
expect_field error unsafe_base_url "private AI endpoint error is explicit"

code=$(curl -sS -c "$PARENT_COOKIE_JAR" -b "$PARENT_COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" \
  -X POST "$BASE/api/parent/summary" -H "Content-Type: application/json" \
  -d "{\"locale\":\"en\",\"parentPassword\":\"$parent_password\"}")
expect_code 200 "$code" "parent summary accepts re-verification"

code=$(curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" -o "$BODY_FILE" -w "%{http_code}" \
  -X POST "$BASE/api/coach" -H "Content-Type: application/json" \
  -d '{"tone":"hint","locale":"zh-Hant","lessonId":"L01"}')
expect_code 200 "$code" "offline static coach fallback"

for _ in 1 2 3 4 5; do
  curl -sS -o "$BODY_FILE" -X POST "$BASE/api/auth/login" -H "Content-Type: application/json" \
    -d "{\"mode\":\"quick\",\"nickname\":\"$nickname\",\"pin\":\"000000\"}" >/dev/null
done
code=$(curl -sS -o "$BODY_FILE" -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"mode\":\"quick\",\"nickname\":\"$nickname\",\"pin\":\"246810\"}")
expect_code 429 "$code" "persistent PIN lock activates after repeated failures"
expect_field error rate_limited "PIN lock error is explicit"

headers=$(curl -sSI "$BASE/")
if grep -qi "content-security-policy" <<<"$headers"; then
  PASS=$((PASS + 1))
  echo "✓ HTML has content security policy"
else
  FAIL=$((FAIL + 1))
  echo "✗ HTML content security policy missing"
fi

echo "PASS=$PASS FAIL=$FAIL"
[[ "$FAIL" -eq 0 ]]
