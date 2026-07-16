#!/bin/sh
set -e

export TZ=${TZ:-Asia/Shanghai}
cp /usr/share/zoneinfo/$TZ /etc/localtime 2>/dev/null || true
echo "$TZ" > /etc/timezone 2>/dev/null || true
echo "Timezone: $TZ, Local time: $(date)"

HTTP_ONLY=${HTTP_ONLY:-false}
if [ -z "$PORT" ]; then
    if [ "$HTTP_ONLY" = "true" ]; then
        PORT=80
    else
        PORT=443
    fi
fi

write_common_locations() {
    cat <<'NGINX'
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50m;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
NGINX
}

if [ "$HTTP_ONLY" = "true" ]; then
    echo "Starting Nginx HTTP on port $PORT, API on port ${API_PORT:-3001}..."
    {
        echo "server {"
        echo "    listen $PORT;"
        write_common_locations
        echo "}"
    } > /etc/nginx/http.d/default.conf
else
    CERT_DIR=/app/server/data/certs
    CERT_FILE=$CERT_DIR/server.crt
    KEY_FILE=$CERT_DIR/server.key
    OPENSSL_CONF_FILE=$CERT_DIR/openssl.cnf
    SSL_CN=${SSL_CN:-asset-manager.local}
    SSL_ALT_NAMES=${SSL_ALT_NAMES:-DNS:localhost,DNS:asset-manager.local,IP:127.0.0.1}

    mkdir -p "$CERT_DIR"
    if [ ! -s "$CERT_FILE" ] || [ ! -s "$KEY_FILE" ]; then
        echo "Generating 100-year self-signed HTTPS certificate in $CERT_DIR..."
        cat > "$OPENSSL_CONF_FILE" <<CERTCONF
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
CN = $SSL_CN

[v3_req]
subjectAltName = $SSL_ALT_NAMES
CERTCONF
        openssl req -x509 -nodes -newkey rsa:2048 -days 36500 \
            -keyout "$KEY_FILE" \
            -out "$CERT_FILE" \
            -config "$OPENSSL_CONF_FILE"
    fi

    echo "Starting Nginx HTTPS on port $PORT, API on port ${API_PORT:-3001}..."
    {
        echo "server {"
        echo "    listen $PORT ssl;"
        echo "    ssl_certificate $CERT_FILE;"
        echo "    ssl_certificate_key $KEY_FILE;"
        echo "    ssl_protocols TLSv1.2 TLSv1.3;"
        echo "    error_page 497 =301 https://\$http_host\$request_uri;"
        write_common_locations
        echo "}"
    } > /etc/nginx/http.d/default.conf
fi

nginx
cd /app/server && node node_modules/.bin/tsx src/index.ts
