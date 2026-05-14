/**
 * SQLite 数据库定期备份到 GitHub
 * 策略：每6小时将 app.db 复制到 backups/ 目录并推送到 GitHub backups 分支
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DB_PATH = path.join(__dirname, 'data', 'app.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const REPO_DIR = path.join(__dirname, '..');
const BRANCH = 'backups';
const INTERVAL = 6 * 60 * 60 * 1000; // 6小时

function getTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function runGit(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_DIR, stdio: 'pipe', timeout: 30000 }).toString().trim();
  } catch (e) {
    console.error(`[备份] git 命令失败: ${cmd}`, e.message);
    return null;
  }
}

function ensureBackupBranch() {
  // 检查 backups 分支是否存在
  const branches = runGit('git branch --list backups');
  if (!branches || !branches.includes('backups')) {
    // 创建孤立分支
    runGit('git branch backups');
  }
}

function performBackup() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('[备份] 数据库文件不存在，跳过备份');
    return;
  }

  const timestamp = getTimestamp();
  const backupFileName = `app_${timestamp}.db`;

  // 确保 backups 目录存在
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 复制数据库文件
  const backupPath = path.join(BACKUP_DIR, backupFileName);
  fs.copyFileSync(DB_PATH, backupPath);

  // 同时保留一个最新副本
  const latestPath = path.join(BACKUP_DIR, 'app_latest.db');
  fs.copyFileSync(DB_PATH, latestPath);

  console.log(`[备份] 数据库已备份: ${backupFileName}`);

  // 推送到 GitHub
  try {
    const currentBranch = runGit('git rev-parse --abbrev-ref HEAD');
    
    // 在当前分支直接添加备份文件并推送
    runGit(`git add backups/`);
    
    const status = runGit('git status --porcelain backups/');
    if (!status) {
      console.log('[备份] 无变更，跳过推送');
      return;
    }

    runGit(`git commit -m "backup: ${timestamp} 数据库自动备份"`);
    const pushResult = runGit('git push origin main');
    
    if (pushResult !== null) {
      console.log(`[备份] 已推送到 GitHub`);
    }

    // 清理超过7天的本地备份文件（保留最近7个）
    cleanOldBackups();
  } catch (e) {
    console.error('[备份] 推送失败:', e.message);
  }
}

function cleanOldBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('app_') && f !== 'app_latest.db' && f.endsWith('.db'))
    .sort()
    .reverse();

  // 保留最近7个备份
  if (files.length > 7) {
    for (const f of files.slice(7)) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      console.log(`[备份] 清理旧备份: ${f}`);
    }
  }
}

function startBackupScheduler() {
  console.log(`[备份] 定时备份已启动，间隔 ${INTERVAL / 3600000} 小时`);
  
  // 启动后立即执行一次
  setTimeout(() => performBackup(), 5000);
  
  // 定时执行
  setInterval(performBackup, INTERVAL);
}

module.exports = { startBackupScheduler, performBackup };
