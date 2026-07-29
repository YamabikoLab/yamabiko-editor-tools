ARG WORDPRESS_IMAGE_TAG=7.0.2-php8.3-apache
FROM wordpress:${WORDPRESS_IMAGE_TAG}

ARG NODE_VERSION=24.5.0
ARG WP_CLI_VERSION=2.12.0
ARG XDEBUG_VERSION=3.4.5
ARG TARGETARCH

ARG LOCAL_UID=${LOCAL_UID:-1000}
ARG LOCAL_GID=${LOCAL_GID:-1000}

RUN groupmod --gid "${LOCAL_GID}" www-data \
    && usermod --uid "${LOCAL_UID}" --gid "${LOCAL_GID}" www-data \
    && mkdir -p /var/www/.vscode-server /var/www/.codex \
    && chown -R www-data:www-data /var/www

ENV COMPOSER_ALLOW_SUPERUSER=1

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        $PHPIZE_DEPS \
        ca-certificates \
        curl \
        git \
        gnupg \
        mariadb-client \
        unzip \
        xz-utils \
        less \
        vim \
        gettext \
        locales \
        zip; \
    architecture="${TARGETARCH:-$(dpkg --print-architecture)}"; \
    case "$architecture" in \
        amd64) node_arch='x64' ;; \
        arm64) node_arch='arm64' ;; \
        *) echo "Unsupported architecture: $architecture" >&2; exit 1 ;; \
    esac; \
    node_archive="node-v${NODE_VERSION}-linux-${node_arch}.tar.xz"; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${node_archive}"; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"; \
    grep " ${node_archive}$" SHASUMS256.txt | sha256sum -c -; \
    tar -xJf "$node_archive" -C /usr/local --strip-components=1; \
    rm -f "$node_archive" SHASUMS256.txt; \
    curl -fsSL \
        "https://github.com/wp-cli/wp-cli/releases/download/v${WP_CLI_VERSION}/wp-cli-${WP_CLI_VERSION}.phar" \
        -o /usr/local/bin/wp; \
    chmod +x /usr/local/bin/wp; \
    pecl install "xdebug-${XDEBUG_VERSION}"; \
    docker-php-ext-enable xdebug; \
    install -m 0755 -d /etc/apt/keyrings; \
    curl -fsSL https://download.docker.com/linux/debian/gpg \
        -o /etc/apt/keyrings/docker.asc; \
    chmod a+r /etc/apt/keyrings/docker.asc; \
    . /etc/os-release; \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian ${VERSION_CODENAME} stable" \
        > /etc/apt/sources.list.d/docker.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        docker-ce-cli \
        docker-compose-plugin; \
    apt-get purge -y --auto-remove $PHPIZE_DEPS; \
    rm -rf /var/lib/apt/lists/* /tmp/pear ~/.pearrc

# Locale settings
ARG LOCALE=${LOCALE:-ja_JP.UTF-8}
ARG TZ=${TZ:-Asia/Tokyo}
ENV TZ=${TZ}

RUN case "${LOCALE}" in \
    ""|*[![:alnum:]_.@-]*) \
    printf '%s\n' "Invalid LOCALE: ${LOCALE}" >&2; \
    exit 1 ;; \
    esac \
    && printf '%s UTF-8\n' "${LOCALE}" > /etc/locale.gen \
    && locale-gen

# GitHub CLI
RUN mkdir -p -m 755 /etc/apt/keyrings \
    && curl -fsSL \
    https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    -o /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && gh --version > /dev/null \
    && mkdir -p /var/www/.config/gh \
    && chown -R www-data:www-data /var/www/.config

# Codex CLI
ARG CODEX_CLI_VERSION=latest
RUN npm install --global "@openai/codex@${CODEX_CLI_VERSION}" \
    && codex --version > /dev/null

# Codex notification hook
ARG CODEX_HOME=${CODEX_HOME:-/var/www/.codex}
COPY .devcontainer/shared/scripts/terminal-bell.sh \
    "${CODEX_HOME}/hooks/terminal-bell.sh"
RUN chmod +x "${CODEX_HOME}/hooks/terminal-bell.sh"
COPY .devcontainer/shared/hooks/hooks.json \
    "${CODEX_HOME}/hooks.json"

# Logcut
COPY --chmod=0755 .devcontainer/shared/bin/logcut /usr/local/bin/logcut

# Entry point script
COPY .devcontainer/shared/scripts/devcontainer-entrypoint.sh \
    /usr/local/bin/devcontainer-entrypoint


RUN chmod +x /usr/local/bin/devcontainer-entrypoint

ENTRYPOINT ["devcontainer-entrypoint"]
CMD ["apache2-foreground"]

# Keep the image startup directory at WordPress's document root.
# The official entrypoint copies WordPress into the current directory.
WORKDIR /var/www/html
