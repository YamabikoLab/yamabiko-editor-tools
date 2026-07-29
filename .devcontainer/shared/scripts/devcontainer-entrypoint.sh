#!/usr/bin/env bash
set -euo pipefail

chown www-data:www-data /var/www/html

if [ -d /var/www/html ]; then
    chown -R www-data:www-data /var/www/html
fi

exec docker-entrypoint.sh "$@"