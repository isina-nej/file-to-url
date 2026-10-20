/**
 * @file High-Fidelity Mock for Telegram Serverless Native SDK
 * @description In-memory database and Bot API mock conforming to Telegram Serverless specifications.
 */

export class BotApiError extends Error {
  constructor(code, description) {
    super(`Bot API Error ${code}: ${description}`);
    this.name = 'BotApiError';
    this.code = code;
    this.description = description;
  }
}

// In-memory data tables
const tableStore = new Map();
let autoIncrementCounters = new Map();

export function resetDatabase() {
  tableStore.clear();
  autoIncrementCounters.clear();
}

function getTable(tableName) {
  if (!tableStore.has(tableName)) {
    tableStore.set(tableName, []);
    autoIncrementCounters.set(tableName, 1);
  }
  return tableStore.get(tableName);
}

// Telegram Bot API Mock calls log
export const apiCalls = {
  sentMessages: [],
  copiedMessages: [],
  editedMessages: [],
  answeredCallbacks: [],
  clear() {
    this.sentMessages.length = 0;
    this.copiedMessages.length = 0;
    this.editedMessages.length = 0;
    this.answeredCallbacks.length = 0;
  },
};

let nextMessageId = 1000;

export const api = {
  async sendMessage(params) {
    const id = ++nextMessageId;
    const record = { message_id: id, ...params };
    apiCalls.sentMessages.push(record);
    return record;
  },

  async copyMessage(params) {
    const id = ++nextMessageId;
    const record = { message_id: id, ...params };
    apiCalls.copiedMessages.push(record);
    return { message_id: id };
  },

  async editMessageText(params) {
    apiCalls.editedMessages.push(params);
    return { message_id: params.message_id, ok: true };
  },

  async answerCallbackQuery(params) {
    apiCalls.answeredCallbacks.push(params);
    return { ok: true };
  },

  async sendDocument(params) {
    return this.sendMessage(params);
  },

  async sendPhoto(params) {
    return this.sendMessage(params);
  },

  async sendVideo(params) {
    return this.sendMessage(params);
  },

  async sendAudio(params) {
    return this.sendMessage(params);
  },

  async sendAnimation(params) {
    return this.sendMessage(params);
  },

  async sendVoice(params) {
    return this.sendMessage(params);
  },
};

function matchesCondition(row, condition) {
  if (!condition) return true;
  if (condition.type === 'eq') {
    return row[condition.column] === condition.value;
  }
  if (condition.type === 'and') {
    return condition.conditions.every(c => matchesCondition(row, c));
  }
  if (condition.type === 'or') {
    return condition.conditions.some(c => matchesCondition(row, c));
  }
  if (condition.type === 'raw_sql') {
    // Basic match evaluator for tests
    return true;
  }
  return true;
}

export const db = {
  select() {
    let targetTable = null;
    let whereCondition = null;
    let limitVal = null;
    let offsetVal = 0;
    let orderByCol = null;

    const query = {
      from(table) {
        targetTable = table._name || table;
        return query;
      },
      where(cond) {
        whereCondition = cond;
        return query;
      },
      orderBy(order) {
        orderByCol = order;
        return query;
      },
      limit(n) {
        limitVal = n;
        return query;
      },
      offset(n) {
        offsetVal = n;
        return query;
      },
      then(resolve, reject) {
        try {
          const rows = getTable(targetTable);
          let filtered = rows.filter(r => matchesCondition(r, whereCondition));

          if (orderByCol && orderByCol.column) {
            filtered.sort((a, b) => (b[orderByCol.column] || 0) - (a[orderByCol.column] || 0));
          }

          if (offsetVal > 0) {
            filtered = filtered.slice(offsetVal);
          }
          if (limitVal !== null) {
            filtered = filtered.slice(0, limitVal);
          }

          resolve([...filtered]);
        } catch (err) {
          reject(err);
        }
      },
    };

    return query;
  },

  insert(table) {
    const tableName = table._name || table;
    return {
      async values(val) {
        const rows = getTable(tableName);
        const record = { ...val };

        if (!record.id) {
          const nextId = autoIncrementCounters.get(tableName);
          record.id = nextId;
          autoIncrementCounters.set(tableName, nextId + 1);
        }

        // Unique constraint check
        if (record.share_token) {
          const exists = rows.find(r => r.share_token === record.share_token);
          if (exists) {
            throw new Error(`UNIQUE constraint failed: ${tableName}.share_token`);
          }
        }
        if (record.event_key) {
          const exists = rows.find(r => r.event_key === record.event_key);
          if (exists) {
            throw new Error(`UNIQUE constraint failed: ${tableName}.event_key`);
          }
        }
        if (record.user_id && tableName === 'upload_sessions') {
          const exists = rows.find(r => r.user_id === record.user_id);
          if (exists) {
            throw new Error(`UNIQUE constraint failed: upload_sessions.user_id`);
          }
        }

        rows.push(record);
        return { lastInsertRowid: record.id, ...record };
      },
    };
  },

  update(table) {
    const tableName = table._name || table;
    let updateFields = {};
    let whereCondition = null;

    const query = {
      set(fields) {
        updateFields = fields;
        return query;
      },
      where(cond) {
        whereCondition = cond;
        return query;
      },
      then(resolve, reject) {
        try {
          const rows = getTable(tableName);
          let updatedCount = 0;
          for (let i = 0; i < rows.length; i++) {
            if (matchesCondition(rows[i], whereCondition)) {
              for (const [k, v] of Object.entries(updateFields)) {
                if (v && v.type === 'raw_sql') {
                  // For download_count + 1
                  rows[i][k] = (rows[i][k] || 0) + 1;
                } else {
                  rows[i][k] = v;
                }
              }
              updatedCount++;
            }
          }
          resolve({ rowsAffected: updatedCount });
        } catch (err) {
          reject(err);
        }
      },
    };

    return query;
  },

  delete(table) {
    const tableName = table._name || table;
    return {
      where(cond) {
        return {
          async then(resolve) {
            const rows = getTable(tableName);
            const remaining = rows.filter(r => !matchesCondition(r, cond));
            tableStore.set(tableName, remaining);
            resolve({ rowsAffected: rows.length - remaining.length });
          },
        };
      },
    };
  },
};
