/**
 * Host half of the token-cost bundle.
 *
 * The plugin is a pure Client decoration: it reads the `tokenUsage` and
 * `modelSelection` session projections and renders the CNY estimate in the
 * `conversation.composer.dock` slot. Nothing is registered on the Host, so
 * this entry point stays empty instead of shipping unused Host behavior.
 */
export function apply() {}
