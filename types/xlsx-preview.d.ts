// https://www.npmjs.com/package/xlsx-preview
declare module "xlsx-preview" {
  export interface XlsxOptions {
    output?: "string" | "arrayBuffer";
    separateSheets: boolean;
    minimumRows: number;
    minimumCols: number;
  }
  export function xlsx2Html(data: Blob | ArrayBuffer | File, options?: Omit<XlsxOptions, "output">): Promise<string>;
  export function xlsx2Html(
    data: Blob | ArrayBuffer | File,
    options: XlsxOptions & { output: "string" }
  ): Promise<string>;
  export function xlsx2Html(
    data: Blob | ArrayBuffer | File,
    options: XlsxOptions & { output: "arrayBuffer" }
  ): Promise<ArrayBuffer>;
}
