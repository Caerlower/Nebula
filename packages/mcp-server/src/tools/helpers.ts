export function textToolResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    isError: false,
  };
}

export function errorToolResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    isError: true,
  };
}
