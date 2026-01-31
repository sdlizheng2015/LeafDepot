// 操作记录接口定义
export interface OperationLog {
  id: string;
  timestamp: string;
  operation_type: string;
  user_id?: string;
  user_name?: string;
  action: string;
  target?: string;
  status: string;
  details: Record<string, any>;
  ip_address?: string;
}

const STORAGE_KEY = 'operation_logs';
const MAX_LOGS = 100; // 最多保留100条记录

/**
 * 生成唯一ID
 */
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取当前时间戳
 */
function getCurrentTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 添加操作记录
 */
export function addOperationLog(log: Omit<OperationLog, 'id' | 'timestamp'>): OperationLog {
  const newLog: OperationLog = {
    id: generateId(),
    timestamp: getCurrentTimestamp(),
    ...log,
  };

  // 获取现有日志
  const existingLogs = getOperationLogs();

  // 添加新日志到开头
  existingLogs.unshift(newLog);

  // 限制日志数量
  const trimmedLogs = existingLogs.slice(0, MAX_LOGS);

  // 保存到 localStorage
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLogs));
  } catch (error) {
    console.error('保存操作记录失败:', error);
  }

  return newLog;
}

/**
 * 获取所有操作记录
 */
export function getOperationLogs(): OperationLog[] {
  try {
    const logsStr = localStorage.getItem(STORAGE_KEY);
    if (!logsStr) {
      return [];
    }
    const logs = JSON.parse(logsStr) as OperationLog[];
    return logs;
  } catch (error) {
    console.error('读取操作记录失败:', error);
    return [];
  }
}

/**
 * 获取最近N条操作记录
 */
export function getRecentOperationLogs(limit: number = 5): OperationLog[] {
  const logs = getOperationLogs();
  return logs.slice(0, limit);
}

/**
 * 清理过期操作记录（超过指定天数）
 */
export function cleanupOldOperationLogs(daysToKeep: number = 90): number {
  const logs = getOperationLogs();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const filteredLogs = logs.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate >= cutoffDate;
  });

  const removedCount = logs.length - filteredLogs.length;

  if (removedCount > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredLogs));
    } catch (error) {
      console.error('清理操作记录失败:', error);
    }
  }

  return removedCount;
}

/**
 * 清空所有操作记录
 */
export function clearAllOperationLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('清空操作记录失败:', error);
  }
}

/**
 * 删除指定ID的操作记录
 */
export function deleteOperationLog(id: string): boolean {
  const logs = getOperationLogs();
  const filteredLogs = logs.filter(log => log.id !== id);

  if (filteredLogs.length < logs.length) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredLogs));
      return true;
    } catch (error) {
      console.error('删除操作记录失败:', error);
      return false;
    }
  }

  return false;
}
