import { describe, expect, it } from "vitest";
import { checkAnswers, defaultFields, fieldsSchema, newField, type FormField } from "@/lib/forms/schema";

const fields: FormField[] = [
  { ...newField("text"), id: "name1", label: "Navn", required: true, mapsTo: "name" },
  { ...newField("text"), id: "firm1", label: "Firma", mapsTo: "company" },
  { ...newField("email"), id: "mail1", label: "E-mail", required: true },
  { ...newField("phone"), id: "tel01", label: "Telefon" },
  { ...newField("select"), id: "pick1", label: "Budget", options: ["Under 10.000", "Over 10.000"] },
  { ...newField("checkbox"), id: "ok001", label: "Ja tak", required: true },
];

describe("checking a visitor's answers", () => {
  it("returns the answers to log and the contact details for the client", () => {
    const result = checkAnswers(
      fields,
      { name1: " Ida Holm ", firm1: "Holm ApS", mail1: "Ida@Example.com", tel01: "+45 11 22 33 44", pick1: "Over 10.000", ok001: true },
      "da",
    );
    expect(result).toEqual({
      ok: true,
      answers: [
        { label: "Navn", value: "Ida Holm" },
        { label: "Firma", value: "Holm ApS" },
        { label: "E-mail", value: "Ida@Example.com" },
        { label: "Telefon", value: "+45 11 22 33 44" },
        { label: "Budget", value: "Over 10.000" },
        { label: "Ja tak", value: "Ja" },
      ],
      contact: { name: "Ida Holm", company: "Holm ApS", email: "ida@example.com", phone: "+45 11 22 33 44" },
    });
  });

  it("explains what's wrong in the form's language", () => {
    const result = checkAnswers(fields, { mail1: "not-an-email", tel01: "12", pick1: "Something else" }, "da");
    expect(result).toEqual({
      ok: false,
      errors: {
        name1: "Udfyld venligst dette felt",
        mail1: "Tjek e-mailadressen",
        tel01: "Tjek telefonnummeret",
        pick1: "Udfyld venligst dette felt",
        ok001: "Sæt venligst flueben her",
      },
    });
    const english = checkAnswers(fields, {}, "en");
    expect(english.ok === false && english.errors.name1).toBe("Please fill this in");
  });

  it("ignores answers to questions the form doesn't have, and skips empty optional ones", () => {
    const result = checkAnswers(fields, { name1: "A", mail1: "a@b.dk", ok001: "on", injected: "<script>" }, "en");
    expect(result.ok && result.answers.map((a) => a.label)).toEqual(["Navn", "E-mail", "Ja tak"]);
  });
});

describe("form fields", () => {
  it("needs an email or phone question, so answers can be matched to a client", () => {
    expect(fieldsSchema.safeParse(defaultFields("da")).success).toBe(true);
    const noContact = fieldsSchema.safeParse([{ ...newField("text"), label: "Name" }]);
    expect(noContact.success).toBe(false);
    expect(noContact.error?.issues[0].message).toMatch(/Email or Phone/);
  });

  it("needs choices for every dropdown", () => {
    const result = fieldsSchema.safeParse([newField("email"), { ...newField("select"), options: [] }]);
    expect(result.success).toBe(false);
  });
});
