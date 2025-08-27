export async function paginate<T>(
  model: any,
  options: {
    page: number;
    limit: number;
    where?: any;
    orderBy?: any;
  }
): Promise<{ items: T[]; total: number }> {
  const {
    page = 1,
    limit = 10,
    where = {},
    orderBy = { createdAt: 'desc' },
  } = options;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    model.findMany({ where, skip, take: limit, orderBy }),
    model.count({ where }),
  ]);

  return { items, total };
}
