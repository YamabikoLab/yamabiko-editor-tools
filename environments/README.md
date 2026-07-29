# Environment definitions

Each `*.env` file defines one isolated WordPress environment. The file name without `.env` must match `ENVIRONMENT_NAME`.

To add an environment:

1. Copy `wp702-default.env` to a new descriptive name.
2. Change `ENVIRONMENT_NAME` and `COMPOSE_PROJECT_NAME` to unique values.
3. Select an unused `WORDPRESS_PORT` and update `WORDPRESS_SITE_URL` to match.
4. Set the required WordPress image tag and any environment-specific values.
5. Run `./scripts/env.sh <environment-name> config` to validate the definition.
6. Run `./scripts/env.sh <environment-name> up`.

No changes to the Compose template or `scripts/env.sh` are required when adding an environment.

Do not commit real credentials. The credentials in the baseline definition are local-development defaults only.
