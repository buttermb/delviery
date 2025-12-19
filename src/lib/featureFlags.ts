// Mock feature flags until tables are created
const mockFlags = {
  'multi_tenant': { enabled: true, rollout_percentage: 100 },
  'advanced_analytics': { enabled: false, rollout_percentage: 0 },
  'ai_recommendations': { enabled: true, rollout_percentage: 50 },
  // Security improvements (Phase 1)
  'USE_HTTP_ONLY_COOKIES': { enabled: true, rollout_percentage: 100 },
  'ENABLE_RATE_LIMITING': { enabled: true, rollout_percentage: 100 },
  'ENABLE_CAPTCHA': { enabled: true, rollout_percentage: 100 },
};

export async function isFeatureEnabled(flagKey: string, tenantId?: string): Promise<boolean> {
  const flag = mockFlags[flagKey as keyof typeof mockFlags];
  return flag?.enabled ?? false;
}

export async function getFeatureFlags(tenantId?: string) {
  return Object.entries(mockFlags).map(([key, value]) => ({
    flag_key: key,
    enabled: value.enabled,
    rollout_percentage: value.rollout_percentage,
  }));
}
