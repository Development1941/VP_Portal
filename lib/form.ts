import type { PermissionKey } from "@/lib/permissions";

export type FormState = { error?: string; ok?: string };

export class PortalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalError";
  }
}

export function str(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

export function num(form: FormData, key: string) {
  const value = Number(form.get(key));
  return Number.isFinite(value) ? value : 0;
}

export function list(form: FormData, key: string) {
  return form.getAll(key).map((value) => String(value));
}

export function asPermissions(values: string[]) {
  return values.filter((value): value is PermissionKey => value.includes("."));
}
