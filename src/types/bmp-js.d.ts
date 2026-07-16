declare module "bmp-js" {
  interface BmpImage {
    width: number;
    height: number;
    data: Buffer;
  }

  const bmp: {
    decode(buffer: Buffer): BmpImage;
  };

  export = bmp;
}
