import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from '../config/index.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logDir: string;

  private constructor() {
    this.logLevel = this.parseLogLevel(config.logging.level);
    this.logDir = config.logging.directory;
    
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, component: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] [${component}] ${message}`;
    
    if (data) {
      return `${baseMessage} ${JSON.stringify(data, null, 2)}`;
    }
    
    return baseMessage;
  }

  private writeToFile(message: string): void {
    const date = new Date();
    const filename = `mcp-${date.toISOString().split('T')[0]}.log`;
    const filepath = join(this.logDir, filename);
    
    try {
      writeFileSync(filepath, message + '\n', { flag: 'a' });
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, levelStr: string, component: string, message: string, data?: any): void {
    if (level >= this.logLevel) {
      const formattedMessage = this.formatMessage(levelStr, component, message, data);
      console.log(formattedMessage);
      this.writeToFile(formattedMessage);
    }
  }

  debug(component: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', component, message, data);
  }

  info(component: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, 'INFO', component, message, data);
  }

  warn(component: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, 'WARN', component, message, data);
  }

  error(component: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, 'ERROR', component, message, data);
  }
}

export const logger = Logger.getInstance();