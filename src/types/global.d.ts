// Minimal ambient declaration to satisfy TypeScript when @types/node isn't present
declare const process: {
  env: { [key: string]: string | undefined };
};

