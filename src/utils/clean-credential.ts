/**
 * Credential sanitisation for MCPB/DXT desktop bundles.
 *
 * When an OPTIONAL `user_config` field is left blank in a Claude Desktop
 * (MCPB/DXT) bundle, the manifest mapping `"${user_config.X}"` is NOT resolved
 * to an empty string — the literal string `${user_config.X}` is injected into
 * the environment variable instead. That value is truthy, so any code that
 * treats "non-empty" as "a real credential" ends up using the placeholder.
 *
 * For Syncro this is catastrophic: the SDK builds
 * `https://${config.subdomain}.syncromsp.com` with no URL validation, so a
 * blank subdomain becomes the host `${user_config.syncro_subdomain}.syncromsp.com`
 * and every request DNS-fails (ENOTFOUND) with a cryptic network error.
 *
 * Mirrors the fix in wyre-technology/itglue-mcp#73.
 */

/** Matches an unresolved MCPB/DXT placeholder such as `${user_config.syncro_subdomain}`. */
const CONFIG_PLACEHOLDER = /^\$\{.*\}$/;

/**
 * Strip empty/whitespace values and unresolved MCPB `"${user_config.X}"`
 * placeholders. Returns the trimmed value when it is a real credential, or
 * `undefined` when it is absent, blank, or an unresolved placeholder.
 */
export function cleanCredential(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || CONFIG_PLACEHOLDER.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}
