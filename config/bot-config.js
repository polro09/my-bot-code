const dotenv = require('dotenv');
const logger = require('../logger');

dotenv.config();

/**
 * 봇 설정 관리 클래스
 */
class BotConfig {
  constructor() {
    this.config = {
      // 기본 설정
      prefix: process.env.DEFAULT_PREFIX || '!',
      welcomeChannelId: process.env.DEFAULT_WELCOME_CHANNEL_ID || null,
      
      // 모듈 설정
      modules: {
        welcome: {
          enabled: true,
          joinMessage: '{username}님이 서버에 입장했습니다!',
          leaveMessage: '{username}님이 서버에서 퇴장했습니다!'
        }
      },
      
      // 웹 서버 설정
      web: {
        port: process.env.WEB_PORT || 3000,
        host: process.env.WEB_HOST || 'localhost'
      }
    };
    
    logger.info('Config', '봇 설정이 로드되었습니다.');
  }

  /**
   * 설정 값을 가져옵니다.
   * @param {string} key 설정 키
   * @param {*} defaultValue 기본값
   * @returns {*} 설정 값
   */
  get(key, defaultValue = null) {
    try {
      const keys = key.split('.');
      let value = this.config;
      
      for (const k of keys) {
        if (value[k] === undefined) {
          return defaultValue;
        }
        value = value[k];
      }
      
      return value;
    } catch (error) {
      logger.error('Config', `설정 값 가져오기 오류: ${error.message}`);
      return defaultValue;
    }
  }

  /**
   * 설정 값을 설정합니다.
   * @param {string} key 설정 키
   * @param {*} value 설정 값
   * @returns {BotConfig} 체이닝을 위한 인스턴스
   */
  set(key, value) {
    try {
      const keys = key.split('.');
      let target = this.config;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (target[k] === undefined) {
          target[k] = {};
        }
        target = target[k];
      }
      
      target[keys[keys.length - 1]] = value;
      logger.info('Config', `설정 '${key}'가 업데이트되었습니다.`);
      return this;
    } catch (error) {
      logger.error('Config', `설정 값 설정 오류: ${error.message}`);
      return this;
    }
  }

  /**
   * 모듈 설정을 가져옵니다.
   * @param {string} moduleName 모듈 이름
   * @returns {object} 모듈 설정
   */
  getModuleConfig(moduleName) {
    return this.get(`modules.${moduleName}`, {});
  }

  /**
   * 모듈 설정을 업데이트합니다.
   * @param {string} moduleName 모듈 이름
   * @param {object} config 업데이트할 설정
   * @returns {BotConfig} 체이닝을 위한 인스턴스
   */
  updateModuleConfig(moduleName, config) {
    const currentConfig = this.getModuleConfig(moduleName);
    this.set(`modules.${moduleName}`, { ...currentConfig, ...config });
    return this;
  }

  /**
   * 전체 설정을 가져옵니다.
   * @returns {object} 전체 설정
   */
  getAllConfig() {
    return { ...this.config };
  }
}

module.exports = new BotConfig();