import axios from 'axios';

// Use BFF proxy for all API calls
export const api = axios.create({
  baseURL: '/api/proxy',
});

export function tinyPngBase64(): string {
  // 1x1 transparent PNG
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/VI7nWwAAAAASUVORK5CYII=';
}
