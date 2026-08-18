import { describe, expect, it } from "vitest";
import { validateScheduledServiceDraft } from "@/lib/service-form";

describe("validateScheduledServiceDraft", () => {
  it("accepts a complete service draft and normalizes the title", () => {
    expect(validateScheduledServiceDraft({ title: "  Servicio dominical  ", date: "2026-08-16", time: "10:00", creationMode: "duplicate" })).toEqual({
      data: { title: "Servicio dominical", date: "2026-08-16", time: "10:00", creationMode: "duplicate" },
    });
  });

  it("rejects missing and malformed values by field", () => {
    const result = validateScheduledServiceDraft({ title: "", date: "2026-02-31", time: "25:70", creationMode: "template" });
    expect(result.data).toBeUndefined();
    expect(result.fieldErrors).toEqual({
      title: "El nombre debe tener al menos 2 caracteres.",
      date: "Selecciona una fecha válida.",
      time: "Selecciona una hora válida.",
    });
  });

  it("falls back to template mode for an unsupported client value", () => {
    expect(validateScheduledServiceDraft({ title: "Servicio", date: "2026-08-16", time: "10:00", creationMode: "other" }).data?.creationMode).toBe("template");
  });
});
