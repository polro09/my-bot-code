const chalk = require('chalk');
const moment = require('moment-timezone');
const emoji = require('node-emoji');

/**
 * 로거 시스템 - 콘솔에 예쁜 로그 메시지를 출력합니다.
 */
class Logger {
  constructor() {
    this.timezone = 'Asia/Seoul';
  }

  /**
   * 현재 시간을 포맷팅합니다.
   * @returns {string} 포맷팅된 시간 문자열
   */
  getTime() {
    return moment().tz(this.timezone).format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * 정보 로그를 출력합니다.
   * @param {string} module 모듈 이름
   * @param {string} message 로그 메시지
   */
  info(module, message) {
    console.log(
      `${chalk.gray(this.getTime())} ${chalk.blue.bold('[INFO]')} ${emoji.get('information_source')} ${chalk.cyan(`[${module}]`)} ${message}`
    );
  }

  /**
   * 성공 로그를 출력합니다.
   * @param {string} module 모듈 이름
   * @param {string} message 로그 메시지
   */
  success(module, message) {
    console.log(
      `${chalk.gray(this.getTime())} ${chalk.green.bold('[SUCCESS]')} ${emoji.get('white_check_mark')} ${chalk.cyan(`[${module}]`)} ${message}`
    );
  }

  /**
   * 경고 로그를 출력합니다.
   * @param {string} module 모듈 이름
   * @param {string} message 로그 메시지
   */
  warn(module, message) {
    console.log(
      `${chalk.gray(this.getTime())} ${chalk.yellow.bold('[WARNING]')} ${emoji.get('warning')} ${chalk.cyan(`[${module}]`)} ${message}`
    );
  }

  /**
   * 에러 로그를 출력합니다.
   * @param {string} module 모듈 이름
   * @param {string} message 로그 메시지
   */
  error(module, message) {
    console.log(
      `${chalk.gray(this.getTime())} ${chalk.red.bold('[ERROR]')} ${emoji.get('x')} ${chalk.cyan(`[${module}]`)} ${message}`
    );
  }

  /**
   * 시스템 로그를 출력합니다.
   * @param {string} module 모듈 이름
   * @param {string} message 로그 메시지
   */
  system(module, message) {
    console.log(
      `${chalk.gray(this.getTime())} ${chalk.magenta.bold('[SYSTEM]')} ${emoji.get('gear')} ${chalk.cyan(`[${module}]`)} ${message}`
    );
  }

  /**
   * 모듈 로그를 출력합니다.
   * @param {string} module 모듈 이름
   * @param {string} message 로그 메시지
   */
  module(module, message) {
    console.log(
      `${chalk.gray(this.getTime())} ${chalk.blue.bold('[MODULE]')} ${emoji.get('package')} ${chalk.cyan(`[${module}]`)} ${message}`
    );
  }

  /**
   * 웹 서버 로그를 출력합니다.
   * @param {string} module 모듈 이름
   * @param {string} message 로그 메시지
   */
  web(module, message) {
    console.log(
      `${chalk.gray(this.getTime())} ${chalk.hex('#FF7F50').bold('[WEB]')} ${emoji.get('globe_with_meridians')} ${chalk.cyan(`[${module}]`)} ${message}`
    );
  }

  /**
   * 디스코드 관련 로그를 출력합니다.
   * @param {string} module 모듈 이름
   * @param {string} message 로그 메시지
   */
  discord(module, message) {
    console.log(
      `${chalk.gray(this.getTime())} ${chalk.hex('#5865F2').bold('[DISCORD]')} ${emoji.get('speech_balloon')} ${chalk.cyan(`[${module}]`)} ${message}`
    );
  }

  /**
   * 커맨드 로그를 출력합니다.
   * @param {string} module 모듈 이름
   * @param {string} message 로그 메시지
   */
  command(module, message) {
    console.log(
      `${chalk.gray(this.getTime())} ${chalk.hex('#FFA500').bold('[COMMAND]')} ${emoji.get('arrow_right')} ${chalk.cyan(`[${module}]`)} ${message}`
    );
  }
}

module.exports = new Logger();