// Minimal ambient declaration to satisfy TypeScript when @types/node isn't present
declare var process: {
  env: { [key: string]: string | undefined };
};

