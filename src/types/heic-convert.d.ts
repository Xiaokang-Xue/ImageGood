declare module "heic-convert" {
  interface HeicConvertInput {
    buffer: Buffer | ArrayBuffer;
    format: "JPEG" | "PNG";
    quality?: number;
  }

  function convert(input: HeicConvertInput): Promise<ArrayBuffer>;

  export = convert;
}
