export type ProviderImageValidationStage = "provider-source" | "normalized-output";

export type ProviderImageValidationPolicy = {
  enforceTargetAspectRatio: boolean;
};

export function getProviderImageValidationPolicy(
  stage: ProviderImageValidationStage,
): ProviderImageValidationPolicy {
  return {
    enforceTargetAspectRatio: stage === "normalized-output",
  };
}
