import "server-only";
import { Readable } from "stream";

interface CosConfig {
  secretId: string;
  secretKey: string;
  region: string;
  bucket: string;
  keyPrefix: string;
  publicBaseUrl: string;
  useProxy: boolean;
}

interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

type CosCallback<T> = (error: Error | null, data: T) => void;

type CosClient = {
  putObject: (
    params: {
      Bucket: string;
      Region: string;
      Key: string;
      Body: Buffer;
      ContentType?: string;
      CacheControl?: string;
    },
    callback: CosCallback<unknown>
  ) => void;
  getObject: (
    params: {
      Bucket: string;
      Region: string;
      Key: string;
    },
    callback: CosCallback<{ Body?: Buffer | string | Readable }>
  ) => void;
};

type CosConstructor = new (options: { SecretId: string; SecretKey: string }) => CosClient;

let cosClient: CosClient | null = null;

function envBoolean(value: string | undefined, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function trimSlashes(value: string) {
  return value.trim().replace(/^\/+|\/+$/g, "");
}

export function isCosStorageEnabled() {
  return (
    envBoolean(process.env.TENCENT_COS_ENABLED) ||
    (process.env.IMAGE_STORAGE_PROVIDER || "").toLowerCase() === "cos"
  );
}

export function getCosKeyPrefix() {
  return trimSlashes(process.env.TENCENT_COS_KEY_PREFIX || "imageGood");
}

export function normalizeCosKey(key: string) {
  return key
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

export function buildTaskObjectKey(input: {
  userId: string;
  taskId: string;
  filename: string;
}) {
  const prefix = getCosKeyPrefix();
  const key = [
    prefix,
    "users",
    input.userId.replace(/[^a-zA-Z0-9_-]/g, ""),
    "tasks",
    input.taskId.replace(/[^a-zA-Z0-9_-]/g, ""),
    input.filename.replace(/[^a-zA-Z0-9_.-]/g, "")
  ]
    .filter(Boolean)
    .join("/");

  return normalizeCosKey(key);
}

function getCosConfig(): CosConfig {
  const secretId = process.env.TENCENT_COS_SECRET_ID || "";
  const secretKey = process.env.TENCENT_COS_SECRET_KEY || "";
  const region = process.env.TENCENT_COS_REGION || "ap-beijing";
  const bucket = process.env.TENCENT_COS_BUCKET || "";

  if (!secretId || !secretKey || !region || !bucket) {
    throw new Error("腾讯云 COS 未配置完整，请检查 TENCENT_COS_SECRET_ID、TENCENT_COS_SECRET_KEY、TENCENT_COS_REGION 和 TENCENT_COS_BUCKET");
  }

  const publicBaseUrl = (process.env.TENCENT_COS_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

  return {
    secretId,
    secretKey,
    region,
    bucket,
    keyPrefix: getCosKeyPrefix(),
    publicBaseUrl,
    useProxy: envBoolean(process.env.TENCENT_COS_USE_PROXY, !publicBaseUrl)
  };
}

async function loadCosSdk() {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<Record<string, unknown>>;
  const sdk = await dynamicImport("cos-nodejs-sdk-v5");
  const candidate = sdk.default || sdk;
  if (typeof candidate !== "function") {
    throw new Error("腾讯云 COS SDK 加载失败，请确认已安装 cos-nodejs-sdk-v5");
  }
  return candidate as CosConstructor;
}

async function getCosClient() {
  if (cosClient) return cosClient;

  const config = getCosConfig();
  const COS = await loadCosSdk();
  cosClient = new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey
  });
  return cosClient;
}

function encodeKey(key: string) {
  return normalizeCosKey(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

export function cosObjectUrl(key: string) {
  const config = getCosConfig();
  const normalizedKey = normalizeCosKey(key);

  if (config.useProxy) {
    return `/api/storage/images/${encodeKey(normalizedKey)}`;
  }

  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl}/${encodeKey(normalizedKey)}`;
  }

  return `https://${config.bucket}.cos.${config.region}.myqcloud.com/${encodeKey(normalizedKey)}`;
}

export async function uploadBufferToCos(input: PutObjectInput) {
  const config = getCosConfig();
  const client = await getCosClient();
  const key = normalizeCosKey(input.key);

  await new Promise<void>((resolve, reject) => {
    client.putObject(
      {
        Bucket: config.bucket,
        Region: config.region,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: "private, max-age=31536000, immutable"
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      }
    );
  });

  return {
    key,
    url: cosObjectUrl(key)
  };
}

async function streamToBuffer(stream: Readable) {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function getCosObjectBuffer(key: string) {
  const config = getCosConfig();
  const client = await getCosClient();
  const normalizedKey = normalizeCosKey(key);

  return new Promise<Buffer>((resolve, reject) => {
    client.getObject(
      {
        Bucket: config.bucket,
        Region: config.region,
        Key: normalizedKey
      },
      async (error, data) => {
        if (error) {
          reject(error);
          return;
        }

        try {
          const body = data?.Body;
          if (Buffer.isBuffer(body)) {
            resolve(body);
            return;
          }
          if (typeof body === "string") {
            resolve(Buffer.from(body));
            return;
          }
          if (body instanceof Readable) {
            resolve(await streamToBuffer(body));
            return;
          }

          reject(new Error("COS 对象内容为空"));
        } catch (streamError) {
          reject(streamError);
        }
      }
    );
  });
}

export function parseTaskInfoFromCosKey(key: string) {
  const normalizedKey = normalizeCosKey(key);
  const prefixParts = getCosKeyPrefix().split("/").filter(Boolean);
  const parts = normalizedKey.split("/");
  const offset = prefixParts.length;

  if (prefixParts.some((part, index) => parts[index] !== part)) {
    return null;
  }
  if (parts[offset] !== "users" || parts[offset + 2] !== "tasks") {
    return null;
  }

  const userId = parts[offset + 1];
  const taskId = parts[offset + 3];
  const filename = parts.slice(offset + 4).join("/");

  if (!userId || !taskId || !filename || filename.includes("..")) {
    return null;
  }

  return {
    userId,
    taskId,
    filename,
    key: normalizedKey
  };
}
