#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
test_root="$(mktemp -d)"
server_log="$test_root/server.log"
cookie_jar="$test_root/cookies.txt"
port=18081
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

payload="$(php -r 'echo json_encode([
  "csrf_token"=>$argv[1], "name"=>"Maria Flores", "email"=>"maria@example.com",
  "phone"=>"(21) 99280-3268", "goal"=>"Hipertrofia", "message"=>"Contato de teste",
  "privacy"=>true, "company_website"=>""
], JSON_UNESCAPED_UNICODE);' "$token")"

status="$(curl -sS -o "$test_root/contact.json" -w '%{http_code}' -b "$cookie_jar" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  --data "$payload" "http://127.0.0.1:$port/api/contact.php")"
[[ "$status" == "200" ]] || { echo "FAIL contact status $status" >&2; cat "$test_root/contact.json" >&2; exit 1; }

php -r '
  $path=$argv[1]; $lines=file($path, FILE_IGNORE_NEW_LINES|FILE_SKIP_EMPTY_LINES);
  $row=json_decode(end($lines), true);
  if (($row["source"] ?? null) !== "contact") { fwrite(STDERR, "FAIL missing contact source\n"); exit(1); }
  if (($row["phone"] ?? null) !== "21992803268") { fwrite(STDERR, "FAIL phone not normalized\n"); exit(1); }
  if (isset($row["ip"])) { fwrite(STDERR, "FAIL raw IP stored\n"); exit(1); }
' "$test_root/storage/contacts.jsonl"

reused="$(curl -sS -o /dev/null -w '%{http_code}' -b "$cookie_jar" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' -H 'X-Requested-With: XMLHttpRequest' \
  --data "$payload" "http://127.0.0.1:$port/api/contact.php")"
[[ "$reused" == "403" ]] || { echo "FAIL consumed token returned $reused" >&2; exit 1; }

echo "contact HTTP tests: ok"
