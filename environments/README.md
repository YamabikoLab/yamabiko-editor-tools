# Environment definitions

Each `*.env` file defines one isolated WordPress environment. The file name without `.env` must match `ENVIRONMENT_NAME`.

To add an environment:

1. Copy `wp702-default.env` to a new descriptive name.
2. Change `ENVIRONMENT_NAME` and `COMPOSE_PROJECT_NAME` to unique values.
3. Select an unused `WORDPRESS_PORT` and update `WORDPRESS_SITE_URL` to match.
4. Set the required WordPress image tag and any environment-specific values.
5. Add `.devcontainer/<environment-name>/devcontainer.json`.
6. Add `.devcontainer/<environment-name>/compose.yaml` that includes the shared Compose file with this environment's `env_file`.
7. Run `./scripts/env.sh <environment-name> config` to validate the definition.
8. Use `Dev Containers: Reopen in Container` or `Dev Containers: Switch Container` in VS Code.

The per-environment Dev Container files are thin standard configuration entries. Do not copy service definitions into them.

No changes to the shared Compose template, Dockerfile, `scripts/env.sh`, or plugin source are required when adding an environment.

Do not commit real credentials. The credentials in the baseline definition are local-development defaults only.
