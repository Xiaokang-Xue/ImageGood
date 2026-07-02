import "server-only";

export class SmsSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SmsSendError";
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SmsSendError("短信服务配置不完整，请联系管理员");
  }
  return value;
}

function maskPhone(phone: string) {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

export function isSmsServiceConfigured() {
  return Boolean(
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID &&
      process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET &&
      process.env.ALIYUN_SMS_SIGN_NAME &&
      process.env.ALIYUN_SMS_TEMPLATE_CODE
  );
}

export async function sendSmsCode(input: { phone: string; code: string }) {
  const accessKeyId = requiredEnv("ALIBABA_CLOUD_ACCESS_KEY_ID");
  const accessKeySecret = requiredEnv("ALIBABA_CLOUD_ACCESS_KEY_SECRET");
  const signName = requiredEnv("ALIYUN_SMS_SIGN_NAME");
  const templateCode = requiredEnv("ALIYUN_SMS_TEMPLATE_CODE");

  const [DysmsapiModule, OpenApiModule, UtilModule] = await Promise.all([
    import("@alicloud/dysmsapi20170525"),
    import("@alicloud/openapi-client"),
    import("@alicloud/tea-util")
  ]);
  const dysmsapiExports = DysmsapiModule as unknown as Record<string, unknown> & { default?: Record<string, unknown> };
  const openApiExports = OpenApiModule as unknown as Record<string, unknown> & { default?: Record<string, unknown> };
  const utilExports = UtilModule as unknown as Record<string, unknown> & { default?: Record<string, unknown> };
  const Dysmsapi = (dysmsapiExports.default || dysmsapiExports) as unknown as new (config: unknown) => {
    sendSmsWithOptions: (request: unknown, runtime: unknown) => Promise<{ body?: { code?: string; message?: string; requestId?: string } }>;
  };
  const OpenApiConfig = (openApiExports.Config || openApiExports.default?.Config) as (new (input: unknown) => { endpoint?: string }) | undefined;
  const SendSmsRequest = (dysmsapiExports.SendSmsRequest || dysmsapiExports.default?.SendSmsRequest) as
    | (new (input: unknown) => unknown)
    | undefined;
  const RuntimeOptions = (utilExports.RuntimeOptions || utilExports.default?.RuntimeOptions) as (new (input: unknown) => unknown) | undefined;

  if (!OpenApiConfig || !SendSmsRequest || !RuntimeOptions) {
    throw new SmsSendError("短信 SDK 加载失败，请检查依赖安装");
  }

  const config = new OpenApiConfig({
    accessKeyId,
    accessKeySecret,
    regionId: process.env.ALIYUN_SMS_REGION_ID || "cn-hangzhou"
  });
  config.endpoint = "dysmsapi.aliyuncs.com";

  const client = new Dysmsapi(config);
  const request = new SendSmsRequest({
    phoneNumbers: input.phone,
    signName,
    templateCode,
    templateParam: JSON.stringify({ code: input.code })
  });
  const runtime = new RuntimeOptions({});
  const response = await client.sendSmsWithOptions(request, runtime);
  const body = response?.body;

  if (body?.code !== "OK") {
    console.warn("[sms] aliyun send failed", {
      phone: maskPhone(input.phone),
      code: body?.code,
      message: body?.message
    });
    throw new SmsSendError(body?.message || "短信验证码发送失败，请稍后重试");
  }

  console.info("[sms] code sent", { phone: maskPhone(input.phone), requestId: body?.requestId });
}
