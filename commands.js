const { REST, Routes } = require('discord.js');
const logger = require('./logger');
const dotenv = require('dotenv');

dotenv.config();

class CommandManager {
  constructor() {
    this.commands = [];
    this.rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  }

  /**
   * 새 명령어를 등록합니다.
   * @param {Object} command 슬래시 커맨드 객체
   */
  registerCommand(command) {
    // 이미 존재하는 명령어인지 확인
    const existingCommand = this.commands.find(cmd => cmd.name === command.name);
    
    if (existingCommand) {
      logger.warn('CommandManager', `'${command.name}' 명령어가 이미 존재합니다. 덮어쓰기합니다.`);
      this.commands = this.commands.filter(cmd => cmd.name !== command.name);
    }
    
    this.commands.push(command);
    logger.success('CommandManager', `'${command.name}' 명령어가 등록되었습니다.`);
    return this;
  }

  /**
   * 모듈에서 여러 명령어를 등록합니다.
   * @param {string} moduleName 모듈 이름
   * @param {Array} commands 슬래시 커맨드 객체 배열
   */
  registerModuleCommands(moduleName, commands) {
    if (!Array.isArray(commands)) {
      logger.error('CommandManager', `${moduleName} 모듈의 명령어는 배열이어야 합니다.`);
      return this;
    }

    commands.forEach(command => {
      this.registerCommand(command);
    });

    logger.module('CommandManager', `${moduleName} 모듈에서 ${commands.length}개 명령어를 등록했습니다.`);
    return this;
  }

  /**
   * Discord API에 슬래시 커맨드를 배포합니다.
   */
  async deployCommands() {
    try {
      logger.system('CommandManager', '슬래시 커맨드를 Discord API에 배포 중...');
      
      // 글로벌 커맨드 배포
      await this.rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: this.commands }
      );
      
      logger.success('CommandManager', `${this.commands.length}개 슬래시 커맨드가 성공적으로 배포되었습니다.`);
    } catch (error) {
      logger.error('CommandManager', `슬래시 커맨드 배포 실패: ${error.message}`);
    }
  }

  /**
   * 등록된 모든 명령어를 반환합니다.
   * @returns {Array} 등록된 모든 커맨드 배열
   */
  getAllCommands() {
    return this.commands;
  }

  /**
   * 특정 이름의 명령어를 찾습니다.
   * @param {string} name 찾을 명령어 이름
   * @returns {Object|null} 찾은 명령어 객체 또는 null
   */
  findCommand(name) {
    return this.commands.find(cmd => cmd.name === name) || null;
  }
}

module.exports = new CommandManager();