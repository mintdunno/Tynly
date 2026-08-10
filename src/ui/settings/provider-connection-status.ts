/**
 * Ephemeral connection feedback for trusted settings UI. It is deliberately not
 * persisted: a past successful request is not proof that a provider is still reachable.
 */
export type ProviderConnectionStatus = 'connected' | 'needs-attention' | 'testing';

export type ProviderConnectionStatuses = Readonly<
  Partial<Record<string, ProviderConnectionStatus>>
>;
