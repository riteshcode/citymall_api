/**
 * Attaches a toJSON transform that:
 *  - renames _id -> id (string)
 *  - strips __v, and any field marked `private: true` in its schema definition
 * Applied to every schema so raw Mongo internals never leak in API responses.
 */
export function toJSONPlugin(schema) {
  const privatePaths = [];
  schema.eachPath((path, type) => {
    if (type.options && type.options.private) {
      privatePaths.push(path);
    }
  });

  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(doc, ret) {
      ret.id = ret._id?.toString();
      delete ret._id;
      privatePaths.forEach((p) => delete ret[p]);
      return ret;
    },
  });
}

/**
 * PATCH endpoints accept a partial `{ en }` or `{ hi }` update for bilingual
 * fields, but Mongoose's `$set`/assignment replaces the whole subdocument —
 * it does not merge `en`/`hi` individually, and both are required. Call this
 * BEFORE assigning `body` onto an existing document so a single-language
 * update doesn't wipe out (and fail validation for) the other language.
 *
 * @param {import('mongoose').Document} existingDoc
 * @param {Record<string, any>} body mutated in place
 * @param {string[]} fields bilingual field names present on both, e.g. ['title', 'description']
 */
export function mergeBilingualFields(existingDoc, body, fields) {
  for (const field of fields) {
    if (body[field]) {
      const current = existingDoc[field]?.toObject ? existingDoc[field].toObject() : existingDoc[field];
      body[field] = { ...current, ...body[field] };
    }
  }
  return body;
}

/**
 * Shared page/limit pagination helper for list endpoints.
 * Returns { docs, total, page, limit, pages }.
 */
export async function paginateQuery(model, filter, { page = 1, limit = 20, sort, populate, select } = {}) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  let query = model.find(filter).sort(sort).skip(skip).limit(safeLimit);
  if (populate) query = query.populate(populate);
  if (select) query = query.select(select);

  const [docs, total] = await Promise.all([query.exec(), model.countDocuments(filter)]);

  return {
    docs,
    total,
    page: safePage,
    limit: safeLimit,
    pages: Math.max(1, Math.ceil(total / safeLimit)),
  };
}
