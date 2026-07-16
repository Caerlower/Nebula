import type { z } from "zod";

/**
 * Minimal Zod → JSON Schema for MCP tool listing.
 * Avoids adding zod-to-json-schema dependency; covers objects/enums/numbers/strings we use.
 */
export function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  return convert(schema);
}

function convert(schema: z.ZodType): Record<string, unknown> {
  const def = schema._def as {
    typeName: string;
    shape?: () => Record<string, z.ZodType>;
    innerType?: z.ZodType;
    schema?: z.ZodType;
    values?: string[];
    checks?: Array<{ kind: string; value?: number }>;
  };

  switch (def.typeName) {
    case "ZodObject": {
      const shape = def.shape?.() ?? {};
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convert(value);
        if (!isOptional(value)) {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
        additionalProperties: false,
      };
    }
    case "ZodString": {
      const out: Record<string, unknown> = { type: "string" };
      for (const check of def.checks ?? []) {
        if (check.kind === "url") out.format = "uri";
        if (check.kind === "min" && check.value !== undefined)
          out.minLength = check.value;
        if (check.kind === "max" && check.value !== undefined)
          out.maxLength = check.value;
      }
      return out;
    }
    case "ZodNumber": {
      const out: Record<string, unknown> = { type: "number" };
      for (const check of def.checks ?? []) {
        if (check.kind === "min" && check.value !== undefined)
          out.minimum = check.value;
        if (check.kind === "max" && check.value !== undefined)
          out.maximum = check.value;
      }
      return out;
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: def.values ?? [] };
    case "ZodOptional":
      return convert(def.innerType!);
    case "ZodDefault":
      return convert(def.innerType!);
    case "ZodEffects":
      return convert(def.schema!);
    default:
      return {};
  }
}

function isOptional(schema: z.ZodType): boolean {
  const typeName = (schema._def as { typeName: string }).typeName;
  return typeName === "ZodOptional" || typeName === "ZodDefault";
}
