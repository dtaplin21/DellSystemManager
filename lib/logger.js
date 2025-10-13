const util = require('util');
const config = require('../config/env');

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const SENSITIVE_KEYS = ['token', 'authorization', 'password', 'secret', 'key', 'apiKey'];
const activeLevel = LEVELS[config.logging.level] ?? LEVELS.info;

const consoleMethodByLevel = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug ? console.debug.bind(console) : console.log.bind(console)
};

const obfuscate = (value) => {
  if (typeof value !== 'string' || value.length === 0) {
    return '[redacted]';
  }

  if (value.length <= 8) {
    return `${value[0]}***${value[value.length - 1]}`;
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
};

const sanitizeValue = (value, key = '') => {
  if (value == null) {
    return value;
  }

  if (typeof value === 'string') {
    if (SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey))) {
      return obfuscate(value);
    }

    if (value.length > 500) {
      return `${value.slice(0, 497)}...`;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [entryKey, entryValue]) => {
      acc[entryKey] = sanitizeValue(entryValue, entryKey);
      return acc;
    }, {});
  }

  return value;
};

const log = (level, message, meta) => {
  if (LEVELS[level] > activeLevel) {
    return;
  }

  const timestamp = new Date().toISOString();
  const payload = sanitizeValue(meta);
  const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  const writer = consoleMethodByLevel[level] || console.log.bind(console);

  if (payload !== undefined) {
    writer(formattedMessage, typeof payload === 'string' ? payload : util.inspect(payload, { depth: 5, colors: false }));
    return;
  }

  writer(formattedMessage);
};

module.exports = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
  obfuscate
};
