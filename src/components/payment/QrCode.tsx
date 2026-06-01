"use client";

const VERSION = 10;
const SIZE = VERSION * 4 + 17;
const DATA_CODEWORDS = 274;
const ECC_CODEWORDS_PER_BLOCK = 18;
const NUM_BLOCKS = 4;

const EXP = new Array<number>(512);
const LOG = new Array<number>(256);

let value = 1;
for (let index = 0; index < 255; index += 1) {
  EXP[index] = value;
  LOG[value] = index;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let index = 255; index < 512; index += 1) {
  EXP[index] = EXP[index - 255];
}

function gfMultiply(left: number, right: number) {
  if (left === 0 || right === 0) return 0;
  return EXP[LOG[left] + LOG[right]];
}

function reedSolomonGenerator(degree: number) {
  let result = [1];
  for (let index = 0; index < degree; index += 1) {
    const next = new Array<number>(result.length + 1).fill(0);
    result.forEach((coefficient, coefficientIndex) => {
      next[coefficientIndex] ^= coefficient;
      next[coefficientIndex + 1] ^= gfMultiply(coefficient, EXP[index]);
    });
    result = next;
  }
  return result;
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree);
  const result = new Array<number>(degree).fill(0);

  data.forEach((byte) => {
    const factor = byte ^ result[0];
    result.copyWithin(0, 1);
    result[degree - 1] = 0;
    for (let index = 0; index < degree; index += 1) {
      result[index] ^= gfMultiply(generator[index + 1], factor);
    }
  });

  return result;
}

function appendBits(bits: number[], valueToAppend: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((valueToAppend >>> index) & 1);
  }
}

function bitsToCodewords(bits: number[]) {
  const result: number[] = [];
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0;
    for (let offset = 0; offset < 8; offset += 1) {
      byte = (byte << 1) | (bits[index + offset] || 0);
    }
    result.push(byte);
  }
  return result;
}

function encodeData(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const bits: number[] = [];

  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 16);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  if (bits.length > DATA_CODEWORDS * 8) {
    throw new Error("二维码内容过长");
  }

  appendBits(bits, 0, Math.min(4, DATA_CODEWORDS * 8 - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const data = bitsToCodewords(bits);
  for (let pad = 0xec; data.length < DATA_CODEWORDS; pad = pad === 0xec ? 0x11 : 0xec) {
    data.push(pad);
  }

  return data;
}

function interleaveWithErrorCorrection(data: number[]) {
  const blocks: number[][] = [];
  const shortDataLength = 68;

  let offset = 0;
  for (let blockIndex = 0; blockIndex < NUM_BLOCKS; blockIndex += 1) {
    const dataLength = shortDataLength + (blockIndex < 2 ? 0 : 1);
    const block = data.slice(offset, offset + dataLength);
    offset += dataLength;
    blocks.push([...block, ...reedSolomonRemainder(block, ECC_CODEWORDS_PER_BLOCK)]);
  }

  const result: number[] = [];
  for (let index = 0; index < shortDataLength + 1; index += 1) {
    blocks.forEach((block, blockIndex) => {
      if (index !== shortDataLength || blockIndex >= 2) {
        result.push(block[index]);
      }
    });
  }
  for (let index = 0; index < ECC_CODEWORDS_PER_BLOCK; index += 1) {
    blocks.forEach((block, blockIndex) => {
      result.push(block[shortDataLength + (blockIndex < 2 ? 0 : 1) + index]);
    });
  }

  return result;
}

function getBit(valueToRead: number, index: number) {
  return ((valueToRead >>> index) & 1) !== 0;
}

function createMatrix(text: string) {
  const modules = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));
  const isFunction = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false));

  const setFunction = (x: number, y: number, dark: boolean) => {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    modules[y][x] = dark;
    isFunction[y][x] = true;
  };

  const drawFinder = (centerX: number, centerY: number) => {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(centerX + dx, centerY + dy, distance !== 2 && distance !== 4);
      }
    }
  };

  const drawAlignment = (centerX: number, centerY: number) => {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        setFunction(centerX + dx, centerY + dy, distance === 0 || distance === 2);
      }
    }
  };

  drawFinder(3, 3);
  drawFinder(SIZE - 4, 3);
  drawFinder(3, SIZE - 4);

  [6, 28, 50].forEach((y) => {
    [6, 28, 50].forEach((x) => {
      if ((x === 6 && y === 6) || (x === 6 && y === 50) || (x === 50 && y === 6)) return;
      drawAlignment(x, y);
    });
  });

  for (let index = 8; index < SIZE - 8; index += 1) {
    setFunction(index, 6, index % 2 === 0);
    setFunction(6, index, index % 2 === 0);
  }

  const drawFormatBits = () => {
    const data = (1 << 3) | 0;
    let remainder = data;
    for (let index = 0; index < 10; index += 1) {
      remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
    }
    const bits = ((data << 10) | remainder) ^ 0x5412;

    for (let index = 0; index <= 5; index += 1) setFunction(8, index, getBit(bits, index));
    setFunction(8, 7, getBit(bits, 6));
    setFunction(8, 8, getBit(bits, 7));
    setFunction(7, 8, getBit(bits, 8));
    for (let index = 9; index < 15; index += 1) setFunction(14 - index, 8, getBit(bits, index));
    for (let index = 0; index < 8; index += 1) setFunction(SIZE - 1 - index, 8, getBit(bits, index));
    for (let index = 8; index < 15; index += 1) setFunction(8, SIZE - 15 + index, getBit(bits, index));
    setFunction(8, SIZE - 8, true);
  };

  const drawVersion = () => {
    let remainder = VERSION;
    for (let index = 0; index < 12; index += 1) {
      remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25);
    }
    const bits = (VERSION << 12) | remainder;

    for (let index = 0; index < 18; index += 1) {
      const bit = getBit(bits, index);
      const x = SIZE - 11 + (index % 3);
      const y = Math.floor(index / 3);
      setFunction(x, y, bit);
      setFunction(y, x, bit);
    }
  };

  drawFormatBits();
  drawVersion();

  const codewords = interleaveWithErrorCorrection(encodeData(text));
  let bitIndex = 0;

  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < SIZE; vertical += 1) {
      const y = ((right + 1) & 2) === 0 ? SIZE - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset;
        if (isFunction[y][x]) continue;

        const byte = codewords[Math.floor(bitIndex / 8)] || 0;
        let dark = getBit(byte, 7 - (bitIndex % 8));
        if ((x + y) % 2 === 0) dark = !dark;
        modules[y][x] = dark;
        bitIndex += 1;
      }
    }
  }

  drawFormatBits();
  return modules;
}

export function QrCode({ value, className }: { value: string; className?: string }) {
  let matrix: boolean[][];

  try {
    matrix = createMatrix(value);
  } catch {
    return (
      <div className={className}>
        <div className="flex aspect-square items-center justify-center rounded-lg bg-slate-100 p-6 text-center text-sm font-semibold text-slate-500">
          支付二维码生成失败
        </div>
      </div>
    );
  }

  const quietZone = 4;
  const viewBoxSize = SIZE + quietZone * 2;

  return (
    <svg viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`} className={className} role="img" aria-label="微信支付二维码">
      <rect width={viewBoxSize} height={viewBoxSize} fill="white" />
      {matrix.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? <rect key={`${x}-${y}`} x={x + quietZone} y={y + quietZone} width="1" height="1" fill="#0f172a" /> : null
        )
      )}
    </svg>
  );
}
