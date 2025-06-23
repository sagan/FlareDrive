import { z } from "zod";

export const FileSchema = z.object({
  key: z.string(),
  name: z.string(),
  depth: z.number(),
  size: z.number(),
  mime: z.string(),
  uploaded: z.coerce.date(),
  md5: z.string(),
  ctime: z.coerce.date(),
  mtime: z.coerce.date(),
  /**
   * Defines an object with string keys and string values.
   * .optional() allows this property to be missing from the input.
   * .default({}) ensures that if it's missing, it will be an empty object
   * in the parsed output, preventing the need to check for undefined.
   */
  customMetadata: z.record(z.string(), z.string()).optional().default({}),
});

export type File = z.infer<typeof FileSchema>;
