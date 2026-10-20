/**
 * @file High-Fidelity Mock for sdk/db
 * @description Provides schema definition functions and query builders for local testing.
 */

export function sqliteTable(name, columns) {
  const table = {
    _name: name,
    _columns: columns,
    ...columns,
  };
  return table;
}

export function text(name) {
  return {
    _name: name,
    _type: 'text',
    primaryKey() { this._isPrimaryKey = true; return this; },
    unique() { this._isUnique = true; return this; },
    notNull() { this._notNull = true; return this; },
    default(val) { this._default = val; return this; },
  };
}

export function integer(name) {
  return {
    _name: name,
    _type: 'integer',
    primaryKey(opts = {}) {
      this._isPrimaryKey = true;
      this._autoIncrement = opts?.autoIncrement || false;
      return this;
    },
    unique() { this._isUnique = true; return this; },
    notNull() { this._notNull = true; return this; },
    default(val) { this._default = val; return this; },
  };
}

export function eq(column, value) {
  return { type: 'eq', column: column._name || column, value };
}

export function and(...conditions) {
  return { type: 'and', conditions: conditions.filter(Boolean) };
}

export function or(...conditions) {
  return { type: 'or', conditions: conditions.filter(Boolean) };
}

export function desc(column) {
  return { type: 'desc', column: column._name || column };
}

export function sql(strings, ...values) {
  return { type: 'raw_sql', strings, values };
}
