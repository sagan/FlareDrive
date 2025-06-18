import { z } from "zod";

export const FileSchema = z.object({
  key: z.string(),
  name: z.string(),
  depth: z.number(),
  size: z.number(),
  mime: z.string(),
  thumbnail: z.string(),
  uploaded: z.coerce.date(),
  md5: z.string(),
  ctime: z.coerce.date(),
  mtime: z.coerce.date(),
});

export type File = z.infer<typeof FileSchema>;
