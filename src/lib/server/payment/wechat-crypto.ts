import "server-only";
import { createCipheriv, createDecipheriv, createSign, createVerify, randomBytes } from "crypto";
import { readFile } from "fs/promises";

export function createNonce() {
  return randomBytes(16).toString("hex");
}

export function createTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}

export async function readPemFile(filePath: string) {
  if (!filePath) {
    throw new Error("微信支付证书路径未配置");
  }
  return readFile(filePath, "utf-8");
}

export function signWechatPayMessage(privateKey: string, message: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  return signer.sign(privateKey, "base64");
}

export function verifyWechatPaySignature(publicKey: string, message: string, signature: string) {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(message);
  verifier.end();
  return verifier.verify(publicKey, signature, "base64");
}

export function buildWechatAuthorizationHeader(input: {
  mchId: string;
  serialNo: string;
  nonce: string;
  timestamp: string;
  signature: string;
}) {
  const parts = [
    `mchid="${input.mchId}"`,
    `nonce_str="${input.nonce}"`,
    `signature="${input.signature}"`,
    `timestamp="${input.timestamp}"`,
    `serial_no="${input.serialNo}"`
  ];

  return `WECHATPAY2-SHA256-RSA2048 ${parts.join(",")}`;
}

export function buildWechatRequestSignatureMessage(input: {
  method: string;
  canonicalUrl: string;
  timestamp: string;
  nonce: string;
  body: string;
}) {
  return `${input.method}\n${input.canonicalUrl}\n${input.timestamp}\n${input.nonce}\n${input.body}\n`;
}

export function buildWechatNotifySignatureMessage(input: {
  timestamp: string;
  nonce: string;
  rawBody: string;
}) {
  return `${input.timestamp}\n${input.nonce}\n${input.rawBody}\n`;
}

export function decryptWechatResource(input: {
  apiV3Key: string;
  nonce: string;
  associatedData?: string;
  ciphertext: string;
}) {
  const encrypted = Buffer.from(input.ciphertext, "base64");
  const authTag = encrypted.subarray(encrypted.length - 16);
  const data = encrypted.subarray(0, encrypted.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(input.apiV3Key, "utf-8"), Buffer.from(input.nonce, "utf-8"));

  if (input.associatedData) {
    decipher.setAAD(Buffer.from(input.associatedData, "utf-8"));
  }

  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf-8");
}

export function encryptWechatResourceForMock(input: {
  apiV3Key: string;
  nonce: string;
  associatedData: string;
  payload: string;
}) {
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(input.apiV3Key, "utf-8"), Buffer.from(input.nonce, "utf-8"));
  cipher.setAAD(Buffer.from(input.associatedData, "utf-8"));
  const encrypted = Buffer.concat([cipher.update(input.payload, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString("base64");
}
