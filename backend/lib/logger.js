/**
 * Simple logger utility
 * Provides structured logging for the application
 */

const logLevels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLogLevel = process.env.LOG_LEVEL || 'info';
const currentLevel = logLevels[currentLogLevel] || logLevels.info;

function shouldLog(level) {
  return logLevels[level] >= currentLevel;
}

function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`.trim();
}

const logger = {
  debug: (message, meta) => {
    if (shouldLog('debug')) {
      console.log(formatMessage('debug', message, meta));
    }
  },

  info: (message, meta) => {
    if (shouldLog('info')) {
      console.log(formatMessage('info', message, meta));
    }
  },

  warn: (message, meta) => {
    if (shouldLog('warn')) {
      console.warn(formatMessage('warn', message, meta));
    }
  },

  error: (message, meta) => {
    if (shouldLog('error')) {
      console.error(formatMessage('error', message, meta));
    }
  }
};

module.exports = logger;

