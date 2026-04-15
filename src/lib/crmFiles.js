import { supabase } from "./supabase";

export const CRM_FILES_BUCKET = "crm-files";

function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIndex]}`;
}

export function createStoragePath({ scope, leadId, fileName }) {
  const safeName = sanitizeFileName(fileName);
  const uniquePrefix = `${Date.now()}-${crypto.randomUUID()}`;

  if (scope === "lead") {
    return `lead/${leadId}/${uniquePrefix}-${safeName}`;
  }

  return `team/${uniquePrefix}-${safeName}`;
}

export async function uploadCrmFile({
  file,
  scope,
  leadId = null,
  category,
  userId,
}) {
  const storagePath = createStoragePath({ scope, leadId, fileName: file.name });

  const metadata = {
    scope,
    lead_id: leadId,
    category,
    bucket_id: CRM_FILES_BUCKET,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || "application/octet-stream",
    file_size: file.size,
    uploaded_by: userId,
  };

  const insertRes = await supabase
    .from("crm_files")
    .insert(metadata)
    .select()
    .single();

  if (insertRes.error) {
    throw insertRes.error;
  }

  const uploadRes = await supabase.storage
    .from(CRM_FILES_BUCKET)
    .upload(storagePath, file, { upsert: false });

  if (uploadRes.error) {
    await supabase.from("crm_files").delete().eq("id", insertRes.data.id);
    throw uploadRes.error;
  }

  return insertRes.data;
}

export async function createSignedFileUrl(storagePath, expiresIn = 120) {
  const { data, error } = await supabase.storage
    .from(CRM_FILES_BUCKET)
    .createSignedUrl(storagePath, expiresIn);

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function deleteCrmFile(fileRecordId, storagePath) {
  const storageRes = await supabase.storage
    .from(CRM_FILES_BUCKET)
    .remove([storagePath]);

  if (storageRes.error) {
    throw storageRes.error;
  }

  const deleteRes = await supabase.from("crm_files").delete().eq("id", fileRecordId);

  if (deleteRes.error) {
    throw deleteRes.error;
  }
}
