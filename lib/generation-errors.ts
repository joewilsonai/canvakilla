export type PublicGenerationErrorInput = {
  code?: string;
  status?: number;
};

export function getPublicGenerationErrorMessage({
  code = "",
  status = 500,
}: PublicGenerationErrorInput) {
  if (code === "openrouter_timeout" || status === 504) {
    return "Image generation timed out. Try again.";
  }

  if (status === 401 || status === 403) {
    return "Image generation is temporarily unavailable.";
  }

  if (status === 408 || status === 409 || status === 425 || status === 429) {
    return "The image provider is busy. Try again in a minute or switch models.";
  }

  if (code === "openrouter_no_image" || status === 502) {
    return "The image provider did not return an image. Try a more direct prompt or a different model.";
  }

  if (status >= 500) {
    return "The image provider is temporarily unavailable. Try again.";
  }

  return "The image provider rejected that request. Try a smaller image, fewer references, or a different prompt.";
}
