#!/usr/bin/env bash
set -euo pipefail

KC_URL="${KC_URL:-http://localhost:8080}"
KC_ADMIN_USER="${KC_ADMIN_USER:-admin}"
KC_ADMIN_PASSWORD="${KC_ADMIN_PASSWORD:-admin}"
KC_REALM="${KC_REALM:-SIRH}"
KC_THEME="${KC_THEME:-sirh}"
KC_CLIENT_ID="${KC_CLIENT_ID:-sirh-frontend}"

require_bin() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Missing required command: $1" >&2
    exit 1
  }
}

require_bin curl
require_bin jq

wait_for_keycloak() {
  for _ in $(seq 1 45); do
    code="$(curl --max-time 2 -s -o /tmp/kc_ready.json -w '%{http_code}' "$KC_URL/realms/master/.well-known/openid-configuration" || true)"
    if [ "$code" = "200" ]; then
      return 0
    fi
    sleep 2
  done
  echo "Keycloak not reachable at $KC_URL" >&2
  exit 1
}

admin_token() {
  curl -s -X POST "$KC_URL/realms/master/protocol/openid-connect/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    -d 'client_id=admin-cli' \
    -d "username=$KC_ADMIN_USER" \
    -d "password=$KC_ADMIN_PASSWORD" \
    -d 'grant_type=password' | jq -r '.access_token'
}

wait_for_keycloak
TOKEN="$(admin_token)"

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Failed to get admin token" >&2
  exit 1
fi

realm_http="$(curl -s -o /tmp/kc_realm.json -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$KC_URL/admin/realms/$KC_REALM")"
if [ "$realm_http" = "404" ]; then
  jq -n \
    --arg realm "$KC_REALM" \
    --arg theme "$KC_THEME" \
    '{
      realm: $realm,
      enabled: true,
      displayName: $realm,
      loginTheme: $theme,
      internationalizationEnabled: true,
      supportedLocales: ["fr", "en"],
      defaultLocale: "fr",
      rememberMe: true,
      loginWithEmailAllowed: true,
      resetPasswordAllowed: true,
      registrationAllowed: false
    }' >/tmp/kc_realm_create.json

  curl -s -X POST "$KC_URL/admin/realms" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @/tmp/kc_realm_create.json >/dev/null
else
  jq --arg theme "$KC_THEME" '.loginTheme = $theme' /tmp/kc_realm.json >/tmp/kc_realm_update.json

  curl -s -X PUT "$KC_URL/admin/realms/$KC_REALM" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @/tmp/kc_realm_update.json >/dev/null
fi

client_count="$(curl -s -H "Authorization: Bearer $TOKEN" "$KC_URL/admin/realms/$KC_REALM/clients?clientId=$KC_CLIENT_ID" | jq 'length')"
if [ "$client_count" = "0" ]; then
  jq -n \
    --arg clientId "$KC_CLIENT_ID" \
    '{
      clientId: $clientId,
      name: "SIRH Frontend",
      enabled: true,
      publicClient: true,
      protocol: "openid-connect",
      standardFlowEnabled: true,
      directAccessGrantsEnabled: true,
      redirectUris: [
        "http://localhost:3000/*",
        "http://localhost:5173/*"
      ],
      webOrigins: [
        "http://localhost:3000",
        "http://localhost:5173"
      ],
      attributes: {
        "pkce.code.challenge.method": "S256"
      }
    }' >/tmp/kc_client_create.json

  curl -s -X POST "$KC_URL/admin/realms/$KC_REALM/clients" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @/tmp/kc_client_create.json >/dev/null
fi

for entry in \
  "marie@acme.sn|Marie|Ndiaye|RH" \
  "amadou@acme.sn|Amadou|Ba|Manager" \
  "fatou@acme.sn|Fatou|Diop|Employee" \
  "ibrahima.sarr@acme.sn|Ibrahima|Sarr|IT"
do
  IFS='|' read -r user first_name last_name role_name <<EOF
$entry
EOF

  count="$(curl -s -H "Authorization: Bearer $TOKEN" "$KC_URL/admin/realms/$KC_REALM/users?username=$user&exact=true" | jq 'length')"
  if [ "$count" = "0" ]; then
    jq -n \
      --arg username "$user" \
      --arg email "$user" \
      --arg firstName "$first_name" \
      --arg lastName "$last_name" \
      '{
        username: $username,
        email: $email,
        enabled: true,
        emailVerified: true,
        firstName: $firstName,
        lastName: $lastName
      }' >/tmp/kc_user_create.json

    curl -s -X POST "$KC_URL/admin/realms/$KC_REALM/users" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      --data-binary @/tmp/kc_user_create.json >/dev/null
  fi

  user_id="$(curl -s -H "Authorization: Bearer $TOKEN" "$KC_URL/admin/realms/$KC_REALM/users?username=$user&exact=true" | jq -r '.[0].id')"

  jq -n \
    --arg username "$user" \
    --arg email "$user" \
    --arg firstName "$first_name" \
    --arg lastName "$last_name" \
    '{
      username: $username,
      email: $email,
      enabled: true,
      emailVerified: true,
      firstName: $firstName,
      lastName: $lastName
    }' >/tmp/kc_user_update.json

  curl -s -X PUT "$KC_URL/admin/realms/$KC_REALM/users/$user_id" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @/tmp/kc_user_update.json >/dev/null

  jq -n '{type: "password", temporary: false, value: "Demo2025!"}' >/tmp/kc_user_pwd.json
  curl -s -X PUT "$KC_URL/admin/realms/$KC_REALM/users/$user_id/reset-password" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @/tmp/kc_user_pwd.json >/dev/null

  role_http="$(curl -s -o /tmp/kc_role.json -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$KC_URL/admin/realms/$KC_REALM/roles/$role_name")"
  if [ "$role_http" = "404" ]; then
    jq -n --arg name "$role_name" '{name: $name}' >/tmp/kc_role_create.json
    curl -s -X POST "$KC_URL/admin/realms/$KC_REALM/roles" \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      --data-binary @/tmp/kc_role_create.json >/dev/null
  fi

  role_rep="$(curl -s -H "Authorization: Bearer $TOKEN" "$KC_URL/admin/realms/$KC_REALM/roles/$role_name")"
  role_id="$(echo "$role_rep" | jq -r '.id')"
  role_name_final="$(echo "$role_rep" | jq -r '.name')"

  jq -n --arg id "$role_id" --arg name "$role_name_final" '[{id: $id, name: $name}]' >/tmp/kc_user_role_map.json
  curl -s -X POST "$KC_URL/admin/realms/$KC_REALM/users/$user_id/role-mappings/realm" \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary @/tmp/kc_user_role_map.json >/dev/null
done

summary="$(curl -s -H "Authorization: Bearer $TOKEN" "$KC_URL/admin/realms/$KC_REALM" | jq -r '.realm + " (loginTheme=" + (.loginTheme // "") + ")"')"
echo "Realm ready: $summary"
echo "Client ready: $KC_CLIENT_ID"
echo "Demo users ready: Marie Ndiaye (RH), Amadou Ba (Manager), Fatou Diop (Employee), Ibrahima Sarr (IT) (password: Demo2025!)"
