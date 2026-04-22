// utils/APIFeatures.js — Query builder for filtering, sorting, pagination
class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    const q = { ...this.queryString };
    ['page', 'sort', 'limit', 'fields', 'search'].forEach(f => delete q[f]);
    let qStr = JSON.stringify(q);
    qStr = qStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);
    this.query = this.query.find(JSON.parse(qStr));
    if (this.queryString.search) {
      this.query = this.query.find({ $text: { $search: this.queryString.search } });
    }
    return this;
  }

  sort() {
    const sortBy = this.queryString.sort
      ? this.queryString.sort.split(',').join(' ')
      : '-createdAt';
    this.query = this.query.sort(sortBy);
    return this;
  }

  paginate() {
    const page = parseInt(this.queryString.page) || 1;
    const limit = parseInt(this.queryString.limit) || 12;
    this.query = this.query.skip((page - 1) * limit).limit(limit);
    return this;
  }

  fields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',');
      // Always include proposalCount
      if (!fields.includes('proposalCount')) {
        fields.push('proposalCount');
      }
      this.query = this.query.select(fields.join(' '));
    }
    // If no fields specified, return all fields (including proposalCount by default)
    return this;
  }
}

module.exports = APIFeatures;
