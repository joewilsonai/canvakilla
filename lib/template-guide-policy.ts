export function shouldAttachTemplateGuideImageForRun(sourceImageCount: number) {
  return sourceImageCount > 0;
}

export function shouldRetryWithoutTemplateGuideImage(status: number) {
  return status === 400 || status === 413 || status === 422;
}
