export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} 환경 변수가 설정되지 않았습니다.`);
  }
  return value;
}

export function getOptionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}
