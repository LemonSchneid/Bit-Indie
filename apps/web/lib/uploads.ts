export interface PresignedUploadPayload {
  uploadUrl: string;
  fields: Record<string, string>;
}

export async function performPresignedUpload(
  payload: PresignedUploadPayload,
  file: File,
): Promise<void> {
  const formData = new FormData();

  Object.entries(payload.fields).forEach(([key, value]) => {
    formData.append(key, value);
  });

  formData.append("file", file);

  const response = await fetch(payload.uploadUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to upload file to storage.");
  }
}
