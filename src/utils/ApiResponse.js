export function sendSuccess(res, { data = null, statusCode = 200, meta } = {}) {
  const body = { success: true, data, error: null };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}
