#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
test_root="$(mktemp -d)"
server_log="$test_root/server.log"
cookie_jar="$test_root/cookies.txt"
port=18082
server_pid=""

cleanup() {
  if [[ -n "$server_pid" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -rf "$test_root"
}
trap cleanup EXIT

cp -R "$project_root/public" "$project_root/private" "$project_root/config" "$test_root/"
php -S "127.0.0.1:$port" -t "$test_root/public" >"$server_log" 2>&1 &
server_pid=$!

for _ in {1..40}; do
  if curl -fsS "http://127.0.0.1:$port/api/csrf.php" -c "$cookie_jar" >"$test_root/csrf.json" 2>/dev/null; then break; fi
  sleep 0.05
done

token="$(php -r '$data=json_decode(stream_get_contents(STDIN), true); echo $data["token"] ?? "";' <"$test_root/csrf.json")"
[[ -n "$token" ]] || { echo "FAIL csrf token" >&2; exit 1; }

get_status="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/api/pre-assessment.php")"
[[ "$get_status" == "405" ]] || { echo "FAIL GET expected 405, got $get_status" >&2; exit 1; }

make_payload() {
  php -r 'echo json_encode([
    "csrf_token"=>$argv[1], "objective"=>"Qualidade de vida", "experience"=>"Iniciante",
    "weekly_frequency"=>"3 a 4 dias", "training_place"=>"Academia",
    "name"=>"João Silva", "email"=>"joao@example.com", "phone"=>"(21) 99280-3268",
    "privacy"=>$argv[2] === "true", "company_website"=>""
  ], JSON_UNESCAPED_UNICODE);' "$1" "$2"
}

bad_token_payload="$(make_payload invalid-token true)"
bad_token_status="$(curl -sS -o /dev/null -w '%{http_code}' -b "$cookie_jar" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  --data "$bad_token_payload" "http://127.0.0.1:$port/api/pre-assessment.php")"
[[ "$bad_token_status" == "403" ]] || { echo "FAIL invalid token expected 403, got $bad_token_status" >&2; exit 1; }

no_consent_payload="$(make_payload "$token" false)"
no_consent_status="$(curl -sS -o /dev/null -w '%{http_code}' -b "$cookie_jar" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  --data "$no_consent_payload" "http://127.0.0.1:$port/api/pre-assessment.php")"
[[ "$no_consent_status" == "422" ]] || { echo "FAIL missing consent expected 422, got $no_consent_status" >&2; exit 1; }

valid_payload="$(make_payload "$token" true)"
valid_status="$(curl -sS -o "$test_root/valid.json" -w '%{http_code}' -b "$cookie_jar" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  --data "$valid_payload" "http://127.0.0.1:$port/api/pre-assessment.php")"
[[ "$valid_status" == "200" ]] || { echo "FAIL valid assessment expected 200, got $valid_status" >&2; cat "$test_root/valid.json" >&2; exit 1; }

php -r '
  $lines=file($argv[1], FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES);
  $row=json_decode(end($lines), true);
  if (($row["source"] ?? null) !== "pre_assessment") { fwrite(STDERR, "FAIL assessment source\n"); exit(1); }
  if (($row["phone"] ?? null) !== "21992803268") { fwrite(STDERR, "FAIL assessment phone\n"); exit(1); }
  if (isset($row["ip"])) { fwrite(STDERR, "FAIL raw IP stored\n"); exit(1); }
' "$test_root/storage/pre-assessments.jsonl"

reused_status="$(curl -sS -o /dev/null -w '%{http_code}' -b "$cookie_jar" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  --data "$valid_payload" "http://127.0.0.1:$port/api/pre-assessment.php")"
[[ "$reused_status" == "403" ]] || { echo "FAIL consumed token expected 403, got $reused_status" >&2; exit 1; }

echo "form HTTP tests: ok"
