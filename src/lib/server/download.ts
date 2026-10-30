// The files Settings hands out: sent as a download, never kept by the browser or a proxy.

export function download(
  body: string | Uint8Array<ArrayBuffer>,
  fileName: string,
  type: string
): Response {
  return new Response(body, {
    headers: {
      'content-type': type,
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'no-store'
    }
  });
}
